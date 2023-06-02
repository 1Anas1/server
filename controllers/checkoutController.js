// Import the models
const { Family, Category,Product } = require('../models/Product');
const Limits = require('../models/Limits');
const Operation = require('../models/Operation');
const OperationLine = require('../models/OperationLine');
const Bracelet = require('../models/Bracelet');
const UserSocket =require('../models/UserSocket');
const User = require("../models/User");
const Chain = require("../models/Chain")
const mongoose = require('mongoose');
const { populate } = require('../models/Budget');

//--------------------------socket-----------------------/

async function emitToUser(userId, event, data, io) {
  try {
    const userSockets = await UserSocket.find({ userId });
    console.log('connecter',userSockets);
    userSockets.forEach((userSocket) => {
      const socketId = userSocket.socketId;
      io.to(socketId).emit(event, data);
    });
  } catch (error) {
    console.error(error);
  }
}
//-------------------------------------------------------/



// Controller function to add a family
const addCategory = async (req, res) => {
  try {
    // Retrieve the family name from the request body
    const { name } = req.body;

    // Create a new family document
    const newCategory = new Category({ name });

    // Save the new family to the database
    await newCategory.save();

    res.json(newCategory);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// Controller function to add a category
const addFamily = async (req, res) => {
  try {
    // Retrieve the category name and family ID from the request body
    const { name, categoryId } = req.body;

    // Check if the family exists
    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    // Create a new category document
    const newFamily = new Family({ name, category: categoryId });

    // Save the new category to the database
    await newFamily.save();

    res.json(newFamily);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
//-----------------------payment------------------------/
const payment = async (req, res,io) => {
  try {
    const { braceletId, products, sellingPointId } = req.body;

    // Check if the bracelet exists
    const bracelet = await Bracelet.findById(braceletId);
    if (!bracelet) {
      return res.status(404).json({ error: 'Bracelet not found' });
    }

    // Calculate the total cost of the products
    let totalCost = 0;
    for (const product of products) {
      const foundProduct = await Product.findById(product._id);
      if (!foundProduct) {
        return res.status(404).json({ error: 'Product not found' });
      }
      totalCost += foundProduct.price * product.quantity;
      product.family = foundProduct.family;
      product.category = foundProduct.category;
    }

    // Check if the bracelet has enough balance for the payment
    if (bracelet.amount < totalCost) {
      return res.status(400).json({ error: 'Insufficient balance in the bracelet' });
    }

    // Create a new operation with approved set to true by default
    const operation = new Operation({
      type: 'payment',
      amount: totalCost,
      bracelet: braceletId,
      date: new Date(),
      approved: true,
      sellingPoint: sellingPointId,
    });

    // Check if the bracelet is disabled
    if (bracelet.is_disabled) {
      operation.approved = false;
      operation.rejectionReason = 'Bracelet is disabled';
    }

    // Check if the payment violates any limits for restricted products, families, or categories
    const limits = await Limits.findOne({ bracelet: braceletId });
    if (limits) {
      for (const product of products) {
        if (
          limits.restrictedProducts.includes(product._id) ||
          limits.restrictedFamilies.includes(product.family) ||
          limits.restrictedCategories.includes(product.category)
        ) {
          operation.approved = false;
          operation.rejectionReason = 'Payment violates the limits set for the bracelet';
          break;
        }
      }
    }

    // Save the operation
    await operation.save();

    // Create operation lines for each product
    const operationLines = [];
    for (const product of products) {
      const foundProduct = await Product.findById(product._id);
      const operationLine = new OperationLine({
        operation: operation._id,
        product: product._id,
        quantity: product.quantity,
        cost: foundProduct.price,
        approved: operation.approved,
      });
      await operationLine.save(); // Save the operation line
      
      operation.operationLines.push(operationLine._id); // Push the operation line ID to the operation
    }

    // If payment is approved, update the bracelet's balance
    
    if (operation.approved) {
      bracelet.amount -= totalCost;
    }
    await operation.save();
    bracelet.operations.push(operation._id)
    // Save the updated bracelet
    await bracelet.save();
    
    // Save the updated operation
    const user = await User.findById(bracelet.user).populate('role').populate({
      path: 'bracelets',
      populate: {
        path: 'operations',
        populate:  [
          { path: 'sellingPoint' },
          { path: 'operationLines', populate: { path: 'product', select: 'name' } }
        ]
      }
    })
    .populate('children').exec();
    if(user){
      console.log('payment')
      await emitToUser(user._id,'user_info',user,io)
    }
    
    

    res.json({ success: true, message: 'Payment processed', operation });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

//---------------------Operation with pagination--------/
const getOperations = async (req, res) => {
  try {
    const { page, limit } = req.query;
    const userId = req.userId; // Assuming req.userId contains the ID of the user

    // Add a condition to find the user with a specific condition
    const user = await User.findOne({ _id: userId }).populate('bracelets');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const pageNumber = parseInt(page, 10) || 1;
    const pageSize = parseInt(limit, 10) || 10;

    const skipCount = (pageNumber - 1) * pageSize;

    const operations = await Operation.find({
      $or: [
        { bracelet: user.bracelets[0]._id },
        { braceletReceiver: user.bracelets[0]._id }
      ]
    }).populate({ path: 'sellingPoint', populate: { path: 'chain_id' } })
      .populate({ path: 'operationLines', populate: { path: 'product' } })
      .populate({ path: 'bracelet', populate: { path: 'user' } })
      .populate({ path: 'braceletReceiver', populate: { path: 'user' } })
      .sort({ date: -1 })
      .skip(skipCount)
      .limit(pageSize);

    // Iterate over the operations and update the type if the condition is met
    operations.forEach((operation) => {
      if(operation.braceletReceiver){
        console.log(operation.braceletReceiver,'receiver')
      if (String(operation.braceletReceiver._id) === String(user.bracelets[0]._id)) {
        operation.type = 'receive';
      }}
    });

    res.status(200).json(operations);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};



//----------------------createLimits--------------------/
const createBraceletLimit = async (req, res) => {
  
  // Extract the limit details from request body
  const { restrictedshop, restrictedProducts,braceletId } = req.body;

  // Find the bracelet by id
  const bracelet = await Bracelet.findById(braceletId);
  if (!bracelet) {
      return res.status(404).send({ message: "Bracelet not found" });
  }

  // Find the shop by id
  const chain = await Chain.findById(restrictedshop);
  if (!chain) {
      return res.status(404).send({ message: "Shop not found" });
  }

  // Create new limit
  const limit = new Limits({
      bracelet: braceletId,
      restrictedshop,
      restrictedProducts,
  });

  // Save the new limit
  await limit.save();

  // Add the limit to the bracelet
  bracelet.restriction.push(limit._id);

  // Save the updated bracelet
  await bracelet.save();

  return res.status(200).send({ message: "Limit added successfully", limit });
};
const updateLimits = async (req, res) => {
  try {
    const { braceletId, limits } = req.body;

    // Delete existing limits for the given braceletId
    await Limits.deleteMany({ bracelet: braceletId });

    if (limits.length > 0) {
      // Create an array of new limits objects with generated ids
      const limitsObjects = limits.map((limit) => ({
        bracelet: braceletId,
        restrictedshop: limit.idShops,
        restrictedProducts: limit.productid,
        _id: mongoose.Types.ObjectId(), // Generate new id
      }));

      console.log(limitsObjects);

      // Save the new limits objects
      await Limits.create(limitsObjects);

      // Push the new limits ids to the 'restriction' array in the Bracelet model
      await Bracelet.updateOne(
        { _id: braceletId },
        { $push: { 'restriction': { $each: limitsObjects.map(obj => obj._id) } } }
      );
    }

    res.status(200).json({ message: 'Limits updated successfully' });
  } catch (error) {
    console.error('Error updating limits:', error);
    res.status(500).json({ error: 'Error updating limits' });
  }
};





//-----------------------------------------------/
const getChainsAndProducts = async (req, res) => {
  try {
    // Get all chains
    const chains = await Chain.find().select('_id chain_name chain_image');

    // Get all products
    const productsData = await Product.find().populate('category', 'name');

    // Group products by type
    let products = {};
    for (let product of productsData) {
      let productType = product.category.name;
      if (!products[productType]) {
        products[productType] = [];
      }
      products[productType].push({id:product._id, name:product.name});
      
    }

    // Form the response
    const result = {
      chains,
      products
    };

    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};




//------------------------------------------------------/


//------------------------------------------------------/

//--------------------------addProduct------------------/
const addProduct = async (req, res) => {
  try {
    const { name, familyId, categoryId, price } = req.body;

    // Check if the provided family and category exist
    const family = await Family.findById(familyId);
    const category = await Category.findById(categoryId);

    if (!family || !category) {
      return res.status(404).json({ error: "Family or category not found" });
    }

    // Create a new product with the provided family, category, and price
    const newProduct = new Product({
      name,
      family: familyId,
      category: categoryId,
      price
    });

    // Save the product
    await newProduct.save();

    res.json({ success: true, message: "Product added successfully" });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

//------------------------------------------------------/

module.exports = {
  addFamily,
  addCategory,
  payment,
  addProduct,
  getOperations,
  createBraceletLimit,
  getChainsAndProducts,
  updateLimits
};
