const User = require("../models/User");
const Role = require("../models/Role");
const Bracelet = require('../models/Bracelet');
const Chain =require ('../models/Chain')
const SellingPoint =require ('../models/SellingPoint')
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const { validationResult } = require("express-validator");
const dotenv = require("dotenv");
const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const UserSocket =require('../models/UserSocket');
const { Family, Category,Product } = require('../models/Product');
const mongoose = require('mongoose');
const geolib = require('geolib');

const Operation = require('../models/Operation');

dotenv.config();

//--------------------------socket-----------------------/

async function emitToUser(userId, event, io) {
  try {
    const userSockets = await UserSocket.find({ userId });
    console.log('connecter');

    const user1 = await User.findById(userId)
      .populate('role')
      .exec();
      let user;
    if (user1.role.name === 'child') {
      console.log("child");
      // Find the user by their ID and populate parent, children, and bracelets


      user = await User.findById(userId)
        .populate('role')
        .populate({
          path: 'parent',
          populate: {
            path: 'bracelets',
          },
          populate: {
            path: 'children',
            populate: {
              path: 'bracelets',
            },
          },
        })
        .populate({
          path: 'bracelets',
          populate: {
            path: 'operations',
            populate: [
              { path: 'sellingPoint' },
              { path: 'operationLines', populate: { path: 'product', select: 'name' } },
            ],
          },
        })
        .exec();

      if (!user.parent) {
        throw new Error('Parent not found');
      }

      // Extract the parent and other children data
     console.log(userId._id)
      const { parent, children } = user;
      const parentWithBracelets = await User.findById(parent._id).populate('bracelets');
      const otherChildren = parent.children.filter(child => child._id.toString() !== userId._id.toString());
     
      // Modify the children array with parent information and bracelet details
      const modifiedChildren = [
        parentWithBracelets,
        ...otherChildren.map(child => child),
      ];

      // Modify the user object with the modified children array
      user.children = modifiedChildren;
      console.log(user)
      userSockets.forEach((userSocket) => {
        const socketId = userSocket.socketId;
        io.to(socketId).emit(event, user);
  
      });
      user={};
    } else {
      console.log("parent");
      // Find the user by their ID and populate role, children, and bracelets
      user = await User.findById(userId)
        .populate('role')
        .populate({
          path: 'children',
          populate: { path: 'bracelets',
          populate:{
            path:'restriction',
            populate:[
              {path:'restrictedshop'},
              {path:'restrictedProducts'}
            ],
        },
        }})
        .populate({
          path: 'bracelets',
          populate: {
            path: 'operations',
            populate: [
              { path: 'sellingPoint' },
              { path: 'operationLines', populate: { path: 'product', select: 'name' } },
            ],
          },
        })
        .exec();

      userSockets.forEach((userSocket) => {
        const socketId = userSocket.socketId;
        io.to(socketId).emit(event, user);
      });
    }
  } catch (error) {
    console.error(error);
  }
}

//-------------------------------------------------------/





const createDefaultRoles = async () => {
  try {
    const memberRole = await Role.findOne({ name: "member" });
    if (!memberRole) {
      await Role.create({ name: "member" });
    }

    const adminRole = await Role.findOne({ name: "admin" });
    if (!adminRole) {
      await Role.create({ name: "admin" });
    }
  } catch (error) {
    console.error("Error creating default roles:", error);
  }
};

exports.createBracelet = async (req, res,io) => {
  try {
    const { type,color,delivery_method,payment_method,userId } = req.body;

    // Create the new bracelet
    const newBracelet = new Bracelet({
      type,
      color,
      delivery_method,
      payment_method,
      amount: 0.00,
      is_disabled: false,
      max_amount:1000,
      duration:30*12,
      user: userId
    });

    // Save the new bracelet to the database
    console.log('1')
    await newBracelet.save();

    // Add the new bracelet to the user's bracelet array
    const user = await User.findById(userId);
    user.bracelets.push(newBracelet._id);
    await user.save();

    // Return the new bracelet object
    await emitToUser(user._id,'user_info',io)
    res.status(201).json(newBracelet);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
};
exports.createBraceletAdmin = async (req, res) => {
  try {
    const { type,color,userId } = req.body;

    // Create the new bracelet
    const newBracelet = new Bracelet({
      type,
      color,
      delivery_method:"poslik office",
      payment_method:"cash on delivery",
      amount: 0.00,
      is_disabled: false,
      max_amount:1000,
      duration:30*12,
      user: userId
    });

    // Save the new bracelet to the database
    console.log('1')
    await newBracelet.save();

    // Add the new bracelet to the user's bracelet array
    const user = await User.findById(userId);
    user.bracelets.push(newBracelet._id);
    user.status="true";
    await user.save();

    // Return the new bracelet object
    
    res.status(201).json(newBracelet);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.addLimits = async (req,res,io) =>{
  try {
    const { braceletId, restrictedProducts, restrictedFamilies, restrictedCategories, paymentLimit } = req.body;

    // Check if the bracelet exists
    const bracelet = await Bracelet.findById(braceletId);
    if (!bracelet) {
      return res.status(404).json({ error: 'Bracelet not found' });
    }

    // Create a new limits document
    const limits = new Limits({
      bracelet: braceletId,
      restrictedProducts,
      restrictedFamilies,
      restrictedCategories,
      paymentLimit,
    });

    // Save the limits document
    await limits.save();

    res.json({ success: true, message: 'Limits added successfully' });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}


exports.addAmount = async (req, res,io) => {
  const { id, amount } = req.body;
  const bracelet = await Bracelet.findById(id);
  console.log(bracelet)
  if (!bracelet) {
    return res.status(404).json({ message: 'Bracelet not found' });
  }
  if (bracelet.user.toString() !== req.user._id.toString()) {
    return res.status(401).json({ message: 'You are not authorized to update this bracelet' });
  }
  bracelet.amount += amount;
  await bracelet.save();
    
  await emitToUser(req.userId,'user_info',io)
  res.json(bracelet);
};
exports.getShopWithEmployees = async (req, res) => {
  try {
    const { shopId } = req.body;
    
    const shop = await SellingPoint.findById(shopId).populate('empl');
    res.json(shop);
  } catch (error) {
    
    res.status(500).json({ message: 'Error retrieving shop with employees' });
  }
};
exports.getUserInfo = async (req, res) => {
  try {
    const { idUser } = req.body;

    const user = await User.findById(idUser)
      .populate({
        path: 'bracelets',
        populate: {
          path: 'operations',
          options: { sort: { date: -1 }, limit: 5 }
        }
      })
      .populate({
        path: 'children',
        populate: {
          path: 'bracelets',
          populate: {
            path: 'operations',
            options: { sort: { created_at: -1 }, limit: 5 }
          }
        }
      })
      .exec();

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json({ user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
};
exports.GetAllInfoUser = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate('role').populate('bracelets')
    .populate('children').exec();
    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
};
exports.GetAllUser = async (req, res) => {
  try {
    if (req.userRole === "admin") {
      const roles = await Role.find({ name: { $in: ["member", "professional"] } });
      const roleIds = roles.map((role) => role._id);

      const users = await User.find({ role: { $in: roleIds } }).populate("bracelets");

      const categorizedUsers = {
        member: [],
        professional: [],
      };

      let memberCount = 1;
      let professionalCount = 1;
      let status1="";
      users.forEach((user) => {
        if(user.status==="true"){
          status1="active"
        }else{
          status1="inactive"

        }
        const formattedUser = {
          idUser:user._id,
          id: user.role.toString() === roles[0]._id.toString() ? memberCount++ : professionalCount++,
          firstname: user.firstName,
          lastname: user.lastName,
          img: user.image,
          email: user.email,
          
          statusaccount: status1,
        };
       
        if (user.role.toString() === roles[0]._id.toString()) {
          if(user.bracelets[0]){
            formattedUser.solde=user.bracelets[0].amount
          if(user.bracelets[0].is_disabled){
            formattedUser.statusbraclet="inactive"
          }else{
            formattedUser.statusbraclet="active"
            
          }}else{
            formattedUser.statusbraclet="inactive"
          }
          categorizedUsers.member.push(formattedUser);
        } else if (user.role.toString() === roles[1]._id.toString()) {
          formattedUser.endcontract = "4/6/2024";
          categorizedUsers.professional.push(formattedUser);
        }
      });

      res.json(categorizedUsers);
    }
    if(req.userRole==="professional"){
      
    }
   
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
};
exports.removeChildAndTransferBraceletAmount = async (req, res,io) => {
  try {
    const { childId, parentId } = req.body;

    // Rechercher l'enfant à supprimer
    const child = await User.findById(childId).populate('bracelets');
    if (!child) {
      return res.status(404).json({ message: 'Enfant non trouvé' });
    }

    // Rechercher le parent
    const parent = await User.findById(parentId).populate('bracelets');
    if (!parent) {
      return res.status(404).json({ message: 'Parent non trouvé' });
    }
   console.log(parent.bracelets[0].amount)
    // Récupérer le montant du bracelet de l'enfant
    const braceletAmount = child.bracelets.reduce((total, bracelet) => total + bracelet.amount, 0);
     console.log(braceletAmount);
    // Ajouter le montant du bracelet au parent
    parent.bracelets[0].amount+=braceletAmount;
    console.log(parent.bracelets[0].amount)
    // Supprimer les bracelets de l'enfant
    await Bracelet.deleteMany({ user: childId });

    // Enregistrer les modifications du parent
     await parent.bracelets[0].save();

    // Supprimer l'enfant
    await User.findByIdAndDelete(childId);
    await emitToUser(parent._id,'user_info',io)
    res.json({ message: 'Enfant supprimé avec succès, les bracelets ont également été supprimés et le montant du bracelet a été transféré au parent.' });
  } catch (error) {
    console.error('Erreur lors de la suppression de l\'enfant :', error.message);
    res.status(500).json({ message: 'Internal server error' });
  }
};

/*exports.signupMember = async (req, res) => {
  try {
    const { firstName, lastName, email, password } = req.body;

    const role = await Role.findOne({ name: "member" });

    if (!role) {
      await createDefaultRoles();
      const role = await Role.findOne({ name: "member" });
    }
    const existingUser = await User.findOne({ email }).populate({
      path: "role",
      match: { $or: [{ name: "member" }, { name: "child" }] },
    });

    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({
      firstName,
      lastName,
      email,
      password: hashedPassword,
      role: role._id,
      status: true, // set default role to 'member'
    });
    await user.save();

    const accessToken = jwt.sign(
      { userId: user._id, role: role.name },
      process.env.JWT_SECRET
    );
    res.json({ user, accessToken });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
};*/



exports.getProfessionalUsers = async (req, res, next) => {
  try {
      const professionalRole = await Role.findOne({ name: "professional" });
      if (!professionalRole) {
          return res.status(404).json({ message: 'Role not found' });
      }

      const users = await User.find({ role: professionalRole._id }).select('_id email').exec();
      res.status(200).json(users);
  } catch (error) {
      res.status(500).json({ error: error.message });
  }
};


exports.signinMember = async (req, res,io) => {
  const { email, password } = req.body;

  // Check if user with given email and role "member" exists
  const existingUser = await User.findOne({ email }).populate({
    path: "role",
    match: { $or: [{ name: "member" }, { name: "child" }] },
  });

  if (!existingUser) {
    return res.status(404).json({ message: "User not found" });
  }

  // Check if password is correct
  const passwordMatch = await bcrypt.compare(password, existingUser.password);

  if (!passwordMatch) {
    return res.status(401).json({ message: "Incorrect password" });
  }
  if(existingUser.status!=="true"){
    return res.status(401).json({ message: "compte desactive" });
  }
  

  // Generate JWT token with user ID and role
  const token = jwt.sign(
    { userId: existingUser._id, role: existingUser.role.name },
    process.env.JWT_SECRET,
    { expiresIn: "1h" }
  );
  
  await emitToUser(existingUser._id,'user_info',io)
  res.status(200).json({ token });
};


exports.getUsersWithoutBracelets = async (req, res) => {
  try {
    const roles = await Role.find({ name: { $in: ['member', 'child'] } });
    const roleIds = roles.map((role) => role._id);
    const users = await User.find({ bracelets: [], role: { $in: roleIds } }, 'email _id');
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving users without bracelets' });
  }
};




exports.logout = (req, res) => {
  res.clearCookie("jwt"); // clear the JWT cookie
  res.status(200).send("Logged out successfully.");
};



exports.verifyEmailExists = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email }).populate({
      path: 'role',
      match: { $or: [{ name: 'child' }, { name: 'member' }] }
    });

    if (user && user.role) {
      // Email exists for the user with role "child" or "member"
      res.status(200).json({ exists: true });
    } else {
      // Email does not exist for the user with role "child" or "member"
      res.status(200).json({ exists: false });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
};


exports.childSignup = async (req, res,io) => {
  try {
    const { firstName,
      lastName,
      email,
      password,
      birthDate,
      gender,image} = req.body;
      console.log('emchy0');

    // Finding the parent user with jwt token
    const parent = await User.findById(req.userId);
    // Create child role if it doesn't exist

    let childRole = await Role.findOne({ name: "child" });
    if (!childRole) {
      childRole = new Role({
        name: "child",
      });
      await childRole.save();
    }
    childRoleId = childRole._id;

    // Check if child user already exists
    const existingUser = await User.findOne({
      email,
      $or: [{ role: childRoleId }, { role: parent.role }],
    });
    console.log('emchy0001');
    if (existingUser) {
      return res.status(400).json({ error: "User already exists." });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    // Create child user
    console.log('emchy0002');
    const user = new User({
      firstName,
      lastName,
      email,
      password:hashedPassword,
      birthDate,
      gender,
      status: true,
      role: childRoleId,
      parent: parent._id,
    });
    console.log('emchy0002');
    console.log('emchy0');
    // Decode and save the image
    const uploadDir = 'uploads/'; // Modify with the actual path to the upload folder
    const decodedImage = Buffer.from(image, 'base64');
    const imageExtension = image.substring("data:image/".length, image.indexOf(";base64"));
    const imageName = `${uuidv4()}.jpg`; // Generate a unique name for the image
    const imagePath = path.join(uploadDir, imageName);

    fs.writeFileSync(imagePath, decodedImage);

    // Store the image URI in the user model
    user.image = imageName;
   /* if (req.file) {
      // Access the uploaded image file using req.file
      console.log('emchy1');
      const image = req.file;
      console.log(image);
      console.log('emchy2');
      // Process the image file as needed (e.g., save it to storage, update the user's image field, etc.)
      user.image = image.filename; // Assuming you want to store the filename in the user's image field
    }*/
    console.log('emchy3');
    await user.save();

    // Add child to parent's children array
    parent.children.push(user._id);
    await parent.save();
    await emitToUser(parent._id,'user_info',io)
    res.status(201).json({userId:user._id, message: "Child user created successfully." });
  } catch (error) {
    console.log('hhhh');
    console.log(error.message);
    res.status(400).json({ error: error.message });
  }
};

exports.SignupMember = async (req, res) => {
  try {
    const { firstName, lastName, email, password, image } = req.body;

    // Create child role if it doesn't exist
    let childRole = await Role.findOne({ name: "member" });
    if (!childRole) {
      childRole = new Role({
        name: "member",
      });
      await childRole.save();
    }
    childRoleId = childRole._id;

    // Check if child user already exists
    const existingUser = await User.findOne({ email }).populate({
      path: "role",
      match: { $or: [{ name: "member" }, { name: "child" }] },
    });
    if (existingUser) {
      return res.status(400).json({ error: "User already exists." });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    // Create child user
    const user = new User({
      firstName,
      lastName,
      email,
      password: hashedPassword,
      status: true,
      role: childRoleId,
    });
    // Decode and save the image
    const uploadDir = 'uploads/'; // Modify with the actual path to the upload folder
    const decodedImage = Buffer.from(image, 'base64');
    const imageExtension = image.substring("data:image/".length, image.indexOf(";base64"));
    const imageName = `${uuidv4()}.jpg`; // Generate a unique name for the image
    const imagePath = path.join(uploadDir, imageName);

    fs.writeFileSync(imagePath, decodedImage);

    // Store the image URI in the user model
    user.image = imageName;
    

    await user.save();

    res.status(201).json({ userId: user._id, message: "Child user created successfully." });
  } catch (error) {
    console.log(error.message);
    res.status(400).json({ error: error.message });
  }
};

exports.SignupMemberAdmin = async (req, res) => {
  try {
    const { firstName,
      lastName,
      email,
      password,
      phone,
      birthDate,
      gender,
      status,
    image} = req.body;

    
    // Create child role if it doesn't exist

    let childRole = await Role.findOne({ name: "member" });
    if (!childRole) {
      childRole = new Role({
        name: "member",
      });
      await childRole.save();
    }
    childRoleId = childRole._id;

    // Check if child user already exists
    const existingUser = await User.findOne({email,}).populate({
      path: "role",
      match: { $or: [{ name: "member" }, { name: "child" }] },
    });
    console.log('emchy0001');
    if (existingUser) {
      return res.status(400).json({ error: "User already exists." });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    // Create child user
    
    const user = new User({
      firstName,
      lastName,
      email,
      password:hashedPassword,
      status,
      phone,
      birthDate,
      gender,
      role: childRoleId,
    });
    // Decode and save the image
    // Decode and save the image
    const uploadDir = 'uploads/'; // Modify with the actual path to the upload folder
    const decodedImage = Buffer.from(image, 'base64');
    const imageExtension = image.substring(image.indexOf("/") + 1, image.indexOf(";base64"));
    const imageName = `${uuidv4()}.${imageExtension}`; // Generate a unique name with the true image extension
    const imagePath = path.join(uploadDir, imageName);

    fs.writeFileSync(imagePath, decodedImage);

    // Store the image URI in the user model
    user.image = imageName;
   
    console.log('emchy3');
    await user.save();


    res.status(201).json({userId:user._id, message: "Child user created successfully." });
  } catch (error) {
    
    console.log(error.message);
    res.status(400).json({ error: error.message });
  }
};
exports.getAmountByCategory = async (req, res) => {
  const { braceletId } = req.body;
  try {
    // Fetch all categories
    const categories = await Category.find();

    const operations = await Operation.aggregate([
      {
        $match: {
          approved: true,
          bracelet: mongoose.Types.ObjectId(braceletId),
        },
      },
      {
        $lookup: {
          from: "operationlines",
          localField: "_id",
          foreignField: "operation",
          as: "operationLines",
        },
      },
      {
        $unwind: "$operationLines",
      },
      {
        $lookup: {
          from: "products",
          localField: "operationLines.product",
          foreignField: "_id",
          as: "product",
        },
      },
      {
        $unwind: "$product",
      },
      {
        $lookup: {
          from: "categories",
          localField: "product.category",
          foreignField: "_id",
          as: "category",
        },
      },
      {
        $unwind: "$category",
      },
      {
        $group: {
          _id: "$category._id",
          category: { $first: "$category.name" },
          totalAmount: {
            $sum: { $multiply: ["$operationLines.cost", "$operationLines.quantity"] },
          },
        },
      },
      {
        $project: {
          _id: 1,
          category: 1,
          totalAmount: 1,
        },
      },
    ]);

    // Create a map to store the total spending for each category
    const categoryMap = new Map();

    // Initialize the category map with zero spending for each category
    categories.forEach((category) => {
      categoryMap.set(category._id.toString(), {
        category: category.name,
        totalAmount: 0,
      });
    });

    // Calculate the total spending for each category from the operations data
    operations.forEach((operation) => {
      console.log(operation)
      const categoryId = operation._id.toString();
      const totalAmount = operation.totalAmount;

      if (categoryMap.has(categoryId)) {
        const categoryData = categoryMap.get(categoryId);
        categoryData.totalAmount += totalAmount;
        categoryMap.set(categoryId, categoryData);
      }
    });

    // Convert the map values to an array
    const categorySpending = Array.from(categoryMap.values());

    res.json(categorySpending);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};






exports.transfer = async (req, res,io) => {
  const { idSender, idReceiver, amount } = req.body;

  try {
    if (req.userRole === 'member') {
      const user = await User.findById(req.userId).populate('bracelets').populate({
        path: 'children',
        populate: { path: 'bracelets' }
      });

      if (user) {
        const senderBracelet = user.bracelets.find((bracelet) => bracelet._id.toString() === idSender);
        const child = user.children.find((child) => child.bracelets.some((bracelet) => bracelet._id.toString() === idReceiver));

        if (senderBracelet && child) {
          const receiverBracelet = child.bracelets.find((bracelet) => bracelet._id.toString() === idReceiver);

          if (senderBracelet.amount < amount) {
            return res.status(400).json({ error: 'Insufficient balance' });
          }

          senderBracelet.amount -= amount;
          receiverBracelet.amount += amount;

          await senderBracelet.save();
          await receiverBracelet.save();
          await user.save();
          await child.save();

          const operation = new Operation({
            type: 'transfer',
            bracelet: senderBracelet._id,
            braceletReceiver: receiverBracelet._id,
            approved: true,
            amount: amount,
            date: Date.now()
          });

          await operation.save();

          const receiverUser = await User.findById(child._id);
          const senderUser = await User.findById(req.userId);

          receiverBracelet.operations.push(operation);
          senderBracelet.operations.push(operation);
          await receiverBracelet.save();
          await senderBracelet.save();
          await receiverUser.save();
          await senderUser.save();

          res.json({
            message: 'Transfer successful',
            receiverBracelet: receiverBracelet._id,
            date: operation.date,
            amount: amount,
            lastName: receiverUser.lastName,
            firstName: receiverUser.firstName,
            image: receiverUser.image
          });
          emitToUser(senderUser._id,'user_info',io)
          emitToUser(receiverUser._id,'user_info',io)
        } else {
          res.status(404).json({ error: 'Bracelet not found' });
        }
      } else {
        res.status(404).json({ error: 'User not found' });
      }
    } else if (req.userRole === 'child') {
      const user = await User.findOne({ _id: req.userId }).populate('bracelets');
      const parent = await User.findOne({ children: req.userId }).populate({
        path: 'children',
        populate: { path: 'bracelets' }
      });

      if (parent) {
        const senderBracelet = user.bracelets.find((bracelet) => bracelet._id.toString() === idSender);
        const receiverChild = parent.children.find((child) => child.bracelets.some((bracelet) => bracelet._id.toString() === idReceiver));
        const parentReceiverBracelet = parent.bracelets.find((bracelet) => bracelet._id.toString() === idReceiver);

        if (senderBracelet && receiverChild) {
          const receiverBracelet = receiverChild.bracelets.find((bracelet) => bracelet._id.toString() === idReceiver);

          if (receiverBracelet) {
            if (senderBracelet.amount < amount) {
              return res.status(400).json({ error: 'Insufficient balance' });
            }

            senderBracelet.amount -= amount;
            receiverBracelet.amount += amount;
            await senderBracelet.save();
            await receiverBracelet.save();
            await user.save();
            await receiverChild.save();

            const operation = new Operation({
              type: 'transfer',
              bracelet: senderBracelet._id,
              braceletReceiver: receiverBracelet._id,
              approved: true,
              amount: amount,
              date: Date.now()
            });

            await operation.save();

            const receiverUser = await User.findById(receiverChild._id);
            const senderUser = await User.findById(req.userId);

            receiverBracelet.operations.push(operation);
            senderBracelet.operations.push(operation);
            await receiverBracelet.save();
            await senderBracelet.save();

            await receiverUser.save();
            await senderUser.save();

            res.json({
              message: 'Transfer successful',
              receiverBracelet: receiverBracelet._id,
              date: operation.date,
              amount: amount,
              lastName: receiverUser.lastName,
              firstName: receiverUser.firstName,
              image: receiverUser.image
            });
            emitToUser(receiverUser._id,'user_info',io)
            emitToUser(senderUser._id,'user_info',io)
          } else if (parentReceiverBracelet) {
            if (senderBracelet.amount < amount) {
              return res.status(400).json({ error: 'Insufficient balance' });
            }

            senderBracelet.amount -= amount;
            parentReceiverBracelet.amount += amount;
            await senderBracelet.save();
            await receiverBracelet.save();
            await user.save();
            await parent.save();

            const operation = new Operation({
              type: 'transfer',
              bracelet: senderBracelet._id,
              braceletReceiver: parentReceiverBracelet._id,
              approved: true,
              amount: amount,
              date: Date.now()
            });

            await operation.save();

            const receiverUser = await User.findById(parent._id);
            const senderUser = await User.findById(req.userId);

            parentReceiverBracelet.operations.push(operation);
            senderBracelet.operations.push(operation);
            await parentReceiverBracelet.save();
            await senderBracelet.save();
            await receiverUser.save();
            await senderUser.save();
            await emitToUser(senderUser._id,'user_info',io)
            await emitToUser(receiverUser._id,'user_info',io)
            res.json({
              message: 'Transfer successful',
              receiverBracelet: parentReceiverBracelet._id,
              amount: amount,
              date: operation.date,
              lastName: receiverUser.lastName,
              firstName: receiverUser.firstName,
              image: receiverUser.image
            });
          } else {
            res.status(404).json({ error: 'Bracelet not found' });
          }
        } else {
          res.status(404).json({ error: 'Bracelet not found' });
        }
      } else {
        res.status(404).json({ error: 'User not found' });
      }
    } else {
      res.status(403).json({ error: 'Forbidden' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};







// Login endpoint for admin user
exports.adminLogin = async (req, res) => {
  try {
    // Check if user exists and has admin role
    const user = await User.findOne({ email: req.body.email }).populate('role');
    if (!user || user.role.name !== 'admin') {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Check password
    const isMatch = await bcrypt.compare(req.body.password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Generate JWT token
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });

    // Return token and user info
    res.status(200).json({ token, user: { firstName: user.firstName, lastName: user.lastName, email: user.email } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
exports.childSignupAdmin = async (req, res) => {
  try {
    const {
      idParent,
      firstName,
      lastName,
      email,
      password,
      phone,
      birthDate,
      gender,
      status,
      image,
    } = req.body;
      console.log('emchy0');

    // Finding the parent user with jwt token
    const parent = await User.findById(idParent);
    // Create child role if it doesn't exist

    let childRole = await Role.findOne({ name: "child" });
    if (!childRole) {
      childRole = new Role({
        name: "child",
      });
      await childRole.save();
    }
    childRoleId = childRole._id;

    // Check if child user already exists
    const existingUser = await User.findOne({
      email,
      $or: [{ role: childRoleId }, { role: parent.role }],
    });
    console.log('emchy0001');
    if (existingUser) {
      return res.status(400).json({ error: "User already exists." });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    // Create child user
    console.log('emchy0002');
    const user = new User({
      firstName,
      lastName,
      email,
      password:hashedPassword,
      birthDate,
      gender,
      phone,
      status,
      role: childRoleId,
      parent: parent._id,
    });
    console.log('emchy0002');
    console.log('emchy0');
    // Decode and save the image
    const uploadDir = 'uploads/'; // Modify with the actual path to the upload folder
    const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
    const imageExtension = image.substring(image.indexOf("/") + 1, image.indexOf(";base64"));
    const imageName = `${uuidv4()}.${imageExtension}`; // Generate a unique name with the true image extension
    const imagePath = path.join(uploadDir, imageName);

    fs.writeFileSync(imagePath, base64Data, { encoding: 'base64' });

    // Store the image URI in the user model
    user.image = imageName;
    
    console.log('emchy3');
    await user.save();

    // Add child to parent's children array
    parent.children.push(user._id);
    await parent.save();
    res.status(201).json({userId:user._id, message: "Child user created successfully." });
  } catch (error) {
    console.log('hhhh');
    console.log(error.message);
    res.status(400).json({ error: error.message });
  }
};
exports.empSignupAdmin = async (req, res) => {
  try {
    const {
      idSellingPoint,
      firstName,
      lastName,
      email,
      password,
      phone,
      roleEmp,
      birthDate,
      image,
    } = req.body;
      console.log('emchy0');

    // Finding the parent user with jwt token
    const sellingPoint = await SellingPoint.findById(idSellingPoint);
    

    let employeeRole = await Role.findOne({ name: "employee" });
    if (!employeeRole) {
      employeeRole = new Role({
        name: "employee",
      });
      await employeeRole.save();
    }
    employeeRoleId = employeeRole._id;

    // Check if child user already exists
    const existingUser = await User.findOne({
      email,
       role: employeeRoleId ,
    });
    console.log('emchy0001');
    if (existingUser) {
      return res.status(400).json({ error: "User already exists." });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    // Create child user
    console.log('emchy0002');
    const user = new User({
      firstName,
      lastName,
      email,
      password:hashedPassword,
      birthDate,
      phone,
      roleEmp,
      status:'true',
      role: employeeRoleId,
      shopEmp:sellingPoint._id
    });
    console.log('emchy0002');
    console.log('emchy0');
    // Decode and save the image
    const uploadDir = 'uploads/'; // Modify with the actual path to the upload folder
    const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
    const imageExtension = image.substring(image.indexOf("/") + 1, image.indexOf(";base64"));
    const imageName = `${uuidv4()}.${imageExtension}`; // Generate a unique name with the true image extension
    const imagePath = path.join(uploadDir, imageName);

    fs.writeFileSync(imagePath, base64Data, { encoding: 'base64' });

    // Store the image URI in the user model
    user.image = imageName;
    
    console.log('emchy3');
    await user.save();

    // Add child to parent's children array
    sellingPoint.empl.push(user._id)
    await sellingPoint.save();
    res.status(201).json({userId:user._id, message: "employee user created successfully." });
  } catch (error) {
    console.log('hhhh');
    console.log(error.message);
    res.status(400).json({ error: error.message });
  }
};

exports.proSignupAdmin = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      password,
      phone,
      birthDate,
      gender,
      status,
      image,
    } = req.body;

    // Create child role if it doesn't exist
    let childRole = await Role.findOne({ name: "professional" });
    if (!childRole) {
      childRole = new Role({
        name: "professional",
      });
      await childRole.save();
    }
    childRoleId = childRole._id;

    // Check if child user already exists
    const existingUser = await User.findOne({ email }).populate({
      path: "role",
      match: { name: "professional" },
    });
    if (existingUser) {
      return res.status(400).json({ error: "User already exists." });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    // Create child user
    const user = new User({
      firstName,
      lastName,
      email,
      password: hashedPassword,
      phone,
      birthDate,
      gender,
      status,
      role: childRoleId,
    });

    // Decode and save the image
    const uploadDir = 'uploads/'; // Modify with the actual path to the upload folder
    const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
    const imageExtension = image.substring(image.indexOf("/") + 1, image.indexOf(";base64"));
    const imageName = `${uuidv4()}.${imageExtension}`; // Generate a unique name with the true image extension
    const imagePath = path.join(uploadDir, imageName);

    fs.writeFileSync(imagePath, base64Data, { encoding: 'base64' });

  
    // Store the image URI in the user model
    user.image = imageName;

    await user.save();

    res.status(201).json({ userId: user._id, message: "Professional user created successfully." });
  } catch (error) {
    console.log(error.message);
    res.status(400).json({ error: error.message });
  }
};
exports.proSignup = async (req, res) => {
  try {
    const { firstName, lastName, email, password } = req.body;
    // Finding the parent user with jwt token
    
    // Create child role if it doesn't exist
    let proRole = await Role.findOne({ name: "professional" });
    if (!proRole) {
      proRole = new Role({
        name: "professional",
      });
      await proRole.save();
    }
    proRoleId = proRole._id;

    // Check if child user already exists
    const existingUser = await User.findOne({ email, role: proRoleId });
    if (existingUser) {
      return res.status(400).json({ error: "User already exists." });
    }
    // Create child user
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({
      firstName,
      lastName,
      email,
      password: hashedPassword,
      status: true,
      role: proRoleId,
    });

    await user.save();
    const accessToken = jwt.sign(
      { userId: user._id, role: proRole.name },
      process.env.JWT_SECRET
    );
    res.status(201).json({ user, accessToken });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
exports.bloquerbracelet = async (req, res, io) => {
  try {
    const { id_bracelet } = req.body;

    if (req.userRole === 'member') {
      const parent = await User.findById(req.userId).populate({
        path: 'children',
        populate: { path: 'bracelets' }
      });

      let foundBracelet = null;

      // Check if the bracelet belongs to the parent
      if (parent.bracelets[0]._id.toString() === id_bracelet) {
        foundBracelet = parent.bracelets[0];
      } else {
        // Check if the bracelet belongs to any of the children
        parent.children.forEach(child => {
          const bracelet = child.bracelets[0];
          if (bracelet._id.toString() === id_bracelet) {
            foundBracelet = bracelet;
          }
        });
      }

      if (foundBracelet) {
        const bra = await Bracelet.findById(foundBracelet)
        bra.is_disabled = !bra.is_disabled; // Update the is_disabled property
        await bra.save(); // Save the changes
        console.log(bra.is_disabled)
        res.status(200).json({ Bracelet: bra.is_disabled, message: 'Bracelet status updated successfully for member' });
      } else {
        res.status(404).json({ message: 'Bracelet not found' });
      }
    } else if (req.userRole === 'admin') {
      const bracelet = await Bracelet.findById(id_bracelet);

      if (bracelet) {
        bracelet.is_disabled = !bracelet.is_disabled; // Update the is_disabled property
        await bracelet.save(); // Save the changes

        res.status(200).json({ Bracelet: bracelet.is_disabled, message: 'Bracelet blocked successfully for admin' });
      } else {
        res.status(404).json({ message: 'Bracelet not found' });
      }
    } else if (req.userRole === 'child') {
      const child = await User.findById(req.userId);
      const bracelet = await Bracelet.findOne({ user: child._id, _id: id_bracelet });

      if (bracelet) {
        bracelet.is_disabled = true; // Update the is_disabled property
        await bracelet.save(); // Save the changes

        res.status(200).json({ Bracelet: bracelet.is_disabled, message: 'Bracelet blocked successfully for child' });
      } else {
        res.status(404).json({ message: 'Bracelet not found for the child' });
      }
    } else {
      res.status(403).json({ message: 'Unauthorized access' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.getBraceletAll = async (req, res) => {
  try {
    
    const braceletall = await Bracelet.find().populate({path:"user",populate:{path:"role"}})

    res.json(braceletall);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

exports.getUserStatistics = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const memberUsers = await User.aggregate([
      { $lookup: { from: 'roles', localField: 'role', foreignField: '_id', as: 'role' } },
      { $match: { 'role.name': 'member' } },
      { $count: 'count' }
    ]);
    
    const professionalUsers = await User.aggregate([
      { $lookup: { from: 'roles', localField: 'role', foreignField: '_id', as: 'role' } },
      { $match: { 'role.name': 'professional' } },
      { $count: 'count' }
    ]);
    const totalBracelets = await Bracelet.countDocuments();

    const memberCount = memberUsers.length > 0 ? memberUsers[0].count : 0;
    const professionalCount = professionalUsers.length > 0 ? professionalUsers[0].count : 0;
    res.json({
      totalUsers,
      memberCount,
      professionalCount,
      totalBracelets,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.getUsersByProfessionalRole = async (req, res) => {
  try {
    const users = await User.find({})
  .populate({
    path: 'role',
    match: { name: { $eq: 'professional' } },
    select: '_id name' // Select the desired fields from the role document
  })
  .select('_id firstName lastName')
  .exec();

const filteredUsers = users.filter(user => user.role !== null);
res.json(filteredUsers);


  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.editUser = async (req, res,io) => {

  try {
    const { userId, firstName, lastName, email, phone, birthDate, image, is_disabled
    } = req.body;

    console.log(req.body);
    // Find the existing user by ID
    const user = await User.findById(userId).populate("bracelets").populate('parent');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Update the user properties
    user.firstName = firstName;
    user.lastName = lastName;
    user.email = email;
    user.phone = phone;
    
    user.birthDate = birthDate;
    user.updated_at = Date.now();

    // Check if there is a new user image provided
    if (image) {
      // Decode the base64 image and save it to the "uploads" folder
      const matches = image.match(/^data:image\/([a-zA-Z+]+);base64,(.+)$/);
      const fileExtension = matches[1];
      const base64Data = matches[2];
      const imageBuffer = Buffer.from(base64Data, 'base64');
      const imageName = `${Date.now()}.${fileExtension}`; // Generate a unique name with the correct file extension
      const imagePath = path.join(__dirname, '../uploads', imageName);
      fs.writeFileSync(imagePath, imageBuffer);

      // Update the user image
      user.image = imageName;
    }

    // Find the bracelet to update
    if(is_disabled==="false" || is_disabled==="true"){
      const bracelet = await Bracelet.findById(user.bracelets[0]);
    if (bracelet) {
      // Update the bracelet status and save it
    if(is_disabled==="false"){
      bracelet.is_disabled = false;
    }
    if(is_disabled==="true"){
      bracelet.is_disabled = true;
    }
    await bracelet.save();
    }

    
    }
   
   

    // Save the updated user
    await user.save();
    await emitToUser(user._id,'user_info',io)
    await emitToUser(user.parent._id,'user_info',io)
    res.json({ message: 'User updated successfully', user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
};


    exports.editUserMobile = async (req, res,io) => {
      try {
        const { userId, firstName, lastName, email, phone, birthDate, image, is_disabled
        } = req.body;
    
        console.log(req.body);
        // Find the existing user by ID
        const user = await User.findById(userId).populate("bracelets").populate('parent');
        if (!user) {
          return res.status(404).json({ error: 'User not found' });
        }
    
        // Update the user properties
        user.firstName = firstName;
        user.lastName = lastName;
        user.email = email;
        user.phone = phone;
        user.birthDate = birthDate;
        user.updated_at = Date.now();
    
        // Check if there is a new user image provided
        if (image) {
          // Decode the base64 image and save it to the "uploads" folder
          const uploadDir = 'uploads/'; // Modify with the actual path to the upload folder
    const decodedImage = Buffer.from(image, 'base64');
    const imageExtension = image.substring("data:image/".length, image.indexOf(";base64"));
    const imageName = `${uuidv4()}.jpg`; // Generate a unique name for the image
    const imagePath = path.join(uploadDir, imageName);

    fs.writeFileSync(imagePath, decodedImage);
    
          // Update the user image
          user.image = imageName;
        }
    
        // Find the bracelet to update
        if(is_disabled==="false" || is_disabled==="true"){
          const bracelet = await Bracelet.findById(user.bracelets[0]);
        if (bracelet) {
          // Update the bracelet status and save it
        if(is_disabled==="false"){
          bracelet.is_disabled = false;
        }
        if(is_disabled==="true"){
          bracelet.is_disabled = true;
        }
        await bracelet.save();
        }
    
        
        }
        
    
        // Save the updated user
        await user.save();
        await emitToUser(user._id,'user_info',io)
        await emitToUser(user.parent._id,'user_info',io)
        res.json({ message: 'User updated successfully', user });
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
      }
    };
    exports.editUserMobilePrinc = async (req, res,io) => {
      try {
        const { userId, firstName, lastName, email, phone, birthDate, image, is_disabled
        } = req.body;
    
        console.log(req.body);
        // Find the existing user by ID
        const user = await User.findById(userId).populate("bracelets").populate('parent');
        if (!user) {
          return res.status(404).json({ error: 'User not found' });
        }
    
        // Update the user properties
        user.firstName = firstName;
        user.lastName = lastName;
        user.email = email;
        user.phone = phone;
        user.birthDate = birthDate;
        user.updated_at = Date.now();
    
        // Check if there is a new user image provided
        if (image) {
          // Decode the base64 image and save it to the "uploads" folder
          const uploadDir = 'uploads/'; // Modify with the actual path to the upload folder
    const decodedImage = Buffer.from(image, 'base64');
    const imageExtension = image.substring("data:image/".length, image.indexOf(";base64"));
    const imageName = `${uuidv4()}.jpg`; // Generate a unique name for the image
    const imagePath = path.join(uploadDir, imageName);

    fs.writeFileSync(imagePath, decodedImage);
    
          // Update the user image
          user.image = imageName;
        }
    
        // Find the bracelet to update
        if(is_disabled==="false" || is_disabled==="true"){
          const bracelet = await Bracelet.findById(user.bracelets[0]);
        if (bracelet) {
          // Update the bracelet status and save it
        if(is_disabled==="false"){
          bracelet.is_disabled = false;
        }
        if(is_disabled==="true"){
          bracelet.is_disabled = true;
        }
        await bracelet.save();
        }
    
        
        }
        
    
        // Save the updated user
        await user.save();
        await emitToUser(user._id,'user_info',io)
       
        res.json({ message: 'User updated successfully', user });
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
      }
    };  
    
    exports.resetPassword = async (req, res, io) => {
      try {
        const { userId, currentPassword, newPassword, retypeNewPassword } = req.body;
        console.log(req.body);
        // Find the existing user by ID
        const user = await User.findById(userId);
        if (!user) {
          return res.status(404).json({ error: 'User not found' });
        }
    
        // Check if the current password matches the one in the database
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
          return res.status(400).json({ error: 'Incorrect current password' });
        }
    
        // Check if the new password and the retyped new password are the same
        if (newPassword !== retypeNewPassword) {
          return res.status(400).json({ error: 'New passwords do not match' });
        }
    
        // Hash the new password
       
        const hashedPassword = await bcrypt.hash(newPassword, 10);
    
        // Update the password and save the user
        user.password = hashedPassword;
        await user.save();
    
        res.json({ message: 'Password updated successfully' });
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
      }
    };
    exports.removeParentAndBracelet = async (req, res, io) => {
      try {
        const { parentId } = req.body;
    
        // Find the parent to delete
        const parent = await User.findById(parentId).populate('bracelets');
        if (!parent) {
          return res.status(404).json({ message: 'Parent not found' });
        }
    
        // Check if parent has a child user
        const childUser = await User.findOne({ parent: parentId });
    
        // If parent has a child user
        if (childUser) {
          return res.status(400).json({ error: "Parent user has a child user. Can not delete the parent." });
        }
    
        // Delete the parent's bracelets
        await Bracelet.deleteMany({ user: parentId });
    
        // Delete the parent
        await User.findByIdAndDelete(parentId);
        
        res.json({ message: 'Parent successfully removed, their bracelet has also been removed.' });
      } catch (error) {
        console.error('Error when removing parent:', error.message);
        res.status(500).json({ message: 'Internal server error' });
      }
    };
    exports.removeProfessional = async (req, res, io) => {
      try {
        const { proId } = req.body;
    
        // Find the professional to delete
        const professional = await User.findById(proId);
        if (!professional) {
          return res.status(404).json({ message: 'Professional not found' });
        }
    
        // Check if professional owns a selling point
        const shop = await SellingPoint.findOne({ owner: proId });
        if (shop) {
          return res.status(400).json({ error: "Professional user owns a selling point. Please delete the selling point before deleting the professional." });
        }
    
        // Check if professional owns a chain
        const chain = await Chain.findOne({ owner: proId });
        if (chain) {
          return res.status(400).json({ error: "Professional user owns a chain. Please delete the chain before deleting the professional." });
        }
    
        // Delete the professional user
        await User.findByIdAndDelete(proId);
       
        res.json({ message: 'Professional successfully removed.' });
      } catch (error) {
        console.error('Error when removing professional:', error.message);
        res.status(500).json({ message: 'Internal server error' });
      }
    };
    exports.empUpdateAdmin = async (req, res) => {
      try {
        const {
          userId,
          firstName,
          lastName,
          email,
          phone,
          roleEmp,
          birthDate,
          image,
        } = req.body;
    
        // Find the user with the given ID
        const user = await User.findById(userId);
    
        if (!user) {
          return res.status(404).json({ error: "User not found." });
        }
    
        // Update user details
        user.firstName = firstName;
        user.lastName = lastName;
        user.email = email;
        user.phone = phone;
        user.roleEmp = roleEmp;
        user.birthDate = birthDate;
    
        // Decode and save the new image
        if (image) {
          const uploadDir = 'uploads/'; // Modify with the actual path to the upload folder
          const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
          const imageExtension = image.substring(image.indexOf("/") + 1, image.indexOf(";base64"));
          const imageName = `${uuidv4()}.${imageExtension}`; // Generate a unique name with the true image extension
          const imagePath = path.join(uploadDir, imageName);
    
          fs.writeFileSync(imagePath, base64Data, { encoding: 'base64' });
    
          // Store the image URI in the user model
          user.image = imageName;
        }
    
        await user.save();
        res.status(200).json({ message: "Employee updated successfully." });
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
      }
    };
    exports.empDeleteAdmin = async (req, res) => {
      try {
          const { userId } = req.body;
  
          // Find the user with the given ID
          const user = await User.findById(userId);
  
          if (!user) {
              return res.status(404).json({ error: "User not found." });
          }
  
          // Delete the user
          await User.findByIdAndRemove(userId);
  
          res.status(200).json({ message: "Employee deleted successfully." });
      } catch (error) {
          console.error(error);
          res.status(500).json({ error: error.message });
      }
  };
  exports.editUseradmin = async (req, res, io) => {
    try {
      const { userId, firstName, lastName, email, phone, birthDate, image, is_disabled } = req.body;
  
      // Find the existing user by ID
      const user = await User.findById(userId).populate("bracelets").populate('parent').populate('role');
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
  
      if (user.role && user.role.name === 'admin') {
        // If role is admin, update only firstName, lastName, and email
        user.firstName = firstName;
        user.lastName = lastName;
        user.email = email;
      } else {
        // Update all the properties for non-admin roles
        user.firstName = firstName;
        user.lastName = lastName;
        user.email = email;
        user.phone = phone;
        user.birthDate = birthDate;
        user.updated_at = Date.now();
      }
  
      // Check if there is a new user image provided
      if (image) {
        // Decode the base64 image and save it to the "uploads" folder
        const matches = image.match(/^data:image\/([a-zA-Z+]+);base64,(.+)$/);
        const fileExtension = matches[1];
        const base64Data = matches[2];
        const imageBuffer = Buffer.from(base64Data, 'base64');
        const imageName = `${Date.now()}.${fileExtension}`; // Generate a unique name with the correct file extension
        const imagePath = path.join(__dirname, '../uploads', imageName);
        fs.writeFileSync(imagePath, imageBuffer);
  
        // Update the user image
        user.image = imageName;
      }
  
      // Find the bracelet to update
      if(is_disabled==="false" || is_disabled==="true"){
        const bracelet = await Bracelet.findById(user.bracelets[0]);
        if (bracelet) {
          // Update the bracelet status and save it
          if(is_disabled==="false"){
            bracelet.is_disabled = false;
          }
          if(is_disabled==="true"){
            bracelet.is_disabled = true;
          }
          await bracelet.save();
        }
      }
  
      // Save the updated user
      await user.save();
      await emitToUser(user._id, 'user_info', io);
      await emitToUser(user.parent._id, 'user_info', io);
      res.json({ message: 'User updated successfully', user });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Server error' });
    }
  };
  
  
  
    
    
    //const geolib = require('geolib');

    // geolib = require('geolib');


exports.getSellingPointsNearPosition = (req, res) => {
  const { longitude, latitude } = req.body; // Get the longitude and latitude from req.body

  // Find selling points near the given position
  SellingPoint.find({
    location: {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [longitude, latitude],
        },
        $maxDistance: 10000, // Specify the maximum distance in meters
      },
    },
  })
    .populate('chain_id')
    .then((sellingPoints) => {
      const sellingPointsWithDistance = sellingPoints.map((point) => {
        const distance = geolib.getDistance(
          { latitude, longitude },
          { latitude: point.location.coordinates[1], longitude: point.location.coordinates[0] }
        );
        return {
          sellingPoint: point,
          distance: distance / 1000, // Convert distance to kilometers
        };
      });

      // Sort the selling points by distance in ascending order
      sellingPointsWithDistance.sort((a, b) => a.distance - b.distance);

      res.json(sellingPointsWithDistance);
    })
    .catch((error) => {
      console.log(error);
      res.status(500).json({ error: 'Internal server error' });
    });
};
exports.getTotalChildCount = (req, res) => {
  Role.findOne({ name: "child" })
    .then(childRole => {
      if (childRole) {
        User.countDocuments({ role: childRole._id })
          .then(childCount => {
            res.json(childCount);
          })
          .catch(err => {
            console.error("Error during User countDocuments:", err);
            res.status(500).json({ error: 'Server error during User countDocuments' });
          });
      } else {
        console.error("Child role not found.");
        res.status(500).json({ error: "Child role not found." });
      }
    })
    .catch(error => {
      console.error("Error during Role findOne:", error);
      res.status(500).json({ error: 'Server error during Role findOne' });
    });
};
exports.getTotalMemberCount = async (req, res) => {
  try {
    // Fetch member role id
    const memberRole = await Role.findOne({ name: "member" });

    // If the member role exists, count the number of users with that role
    if(memberRole) {
      const memberCount = await User.countDocuments({ role: memberRole._id });
      res.json(memberCount);
    } else {
      throw new Error("Member role not found.");
    }

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
};
exports.getTotalProCount = async (req, res) => {
  try {
    // Fetch professional role id
    const proRole = await Role.findOne({ name: "professional" });

    // If the professional role exists, count the number of users with that role
    if(proRole) {
      const proCount = await User.countDocuments({ role: proRole._id });
      res.json(proCount);
    } else {
      throw new Error("Professional role not found.");
    }

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
};
exports.getTotalBraceletCount = async (req, res) => {
  try {
    // Count the number of bracelets
    const braceletCount = await Bracelet.countDocuments();
    res.json(braceletCount);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
};


    

    
    
    
    
    