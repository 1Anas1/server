const User = require("../models/User");
const Role = require("../models/Role");
const Bracelet = require('../models/Bracelet');
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const { validationResult } = require("express-validator");
const dotenv = require("dotenv");
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const UserSocket =require('../models/UserSocket');
const { Family, Category,Product } = require('../models/Product');

const Operation = require('../models/Operation');

dotenv.config();

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

exports.createBracelet = async (req, res) => {
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
    const user = await User.findById(req.user._id).populate('role').populate({
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
  await emitToUser(user._id,'user_info',user,io)
  res.json(bracelet);
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
    if(req.userRole==="admin"){
  
    console.log("hhhh");
    const roles = await Role.find({ name: { $in: ["member", "professional"] } });
    const roleIds = roles.map((role) => role._id);
    console.log("hhhh");
    const users = await User.find({ role: { $in: roleIds } });
    console.log("hhhh");
    const categorizedUsers = {
      member: [],
      professional: [],
    };

    users.forEach((user) => {
      if (user.role.toString() === roles[0]._id.toString()) {
        categorizedUsers.member.push(user);
      } else if (user.role.toString() === roles[1]._id.toString()) {
        categorizedUsers.professional.push(user);
      }
    });

    const response = {
      member: categorizedUsers.member,
      professional: categorizedUsers.professional,
    };

    res.json(response);
  
    }
    if(req.userRole==="professional"){
      
    }
   
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
};
exports.removeChildAndTransferBraceletAmount = async (req, res) => {
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

  // Generate JWT token with user ID and role
  const token = jwt.sign(
    { userId: existingUser._id, role: existingUser.role.name },
    process.env.JWT_SECRET,
    { expiresIn: "1h" }
  );
  const user = await User.findById(existingUser._id).populate('role').populate('bracelets')
    .populate('children').exec();
  await emitToUser(existingUser._id,'user_info',user,io)
  res.status(200).json({ token });
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


exports.childSignup = async (req, res) => {
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

    res.status(201).json({userId:user._id, message: "Child user created successfully." });
  } catch (error) {
    console.log('hhhh');
    console.log(error.message);
    res.status(400).json({ error: error.message });
  }
};

exports.SignupMember = async (req, res) => {
  try {
    const { firstName,
      lastName,
      email,
      password,
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
   
    console.log('emchy3');
    await user.save();


    res.status(201).json({userId:user._id, message: "Child user created successfully." });
  } catch (error) {
    
    console.log(error.message);
    res.status(400).json({ error: error.message });
  }
};
exports.getPaymentStatisticsByCategory = async (req, res) => {
  try {
    const { userId } = req.body;

    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth();

    const categories = await Category.find(); // Get all categories
    const userStatistics = [];

    for (const category of categories) {
      const operations = await Operation.aggregate([
        {
          $match: {
            userId,
            approved: true,
            type: "payment",
            date: {
              $gte: new Date(currentYear, currentMonth, 1), // Start of the current month
              $lt: new Date(currentYear, currentMonth + 1, 1), // Start of the next month
            },
          },
        },
        {
          $lookup: {
            from: "operationLines",
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
            from: "category",
            localField: "operationLines.category",
            foreignField: "_id",
            as: "category",
          },
        },
        {
          $match: {
            "category.name": category.name,
          },
        },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: "$operationLines.amount" },
          },
        },
        {
          $project: {
            _id: 0,
            category: category.name,
            year: currentYear,
            month: currentMonth + 1,
            totalAmount: 1,
          },
        },
      ]);

      const categoryStatistics = operations[0] || { totalAmount: 0 };

      userStatistics.push(categoryStatistics);
    }

    res.json(userStatistics);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};


exports.transfer = async (req, res) => {
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

          res.json({
            message: 'Transfer successful',
            receiverBracelet: receiverBracelet._id,
            date: operation.date,
            amount: amount,
            lastName: receiverUser.lastName,
            firstName: receiverUser.firstName,
            image: receiverUser.image
          });
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

            res.json({
              message: 'Transfer successful',
              receiverBracelet: receiverBracelet._id,
              date: operation.date,
              amount: amount,
              lastName: receiverUser.lastName,
              firstName: receiverUser.firstName,
              image: receiverUser.image
            });
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
exports.bloquerbracelet = async (req, res) => {
  try {
    const { id_bracelet } = req.body;

    if (req.userRole === 'member') {
      
      const parent = await User.findById(req.userId).populate({
        path: 'children',
        populate: { path: 'bracelets' }
      });
      console.log(parent)
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
        foundBracelet.is_disabled = !foundBracelet.is_disabled;
        await foundBracelet.save();
        res.status(200).json({ message: 'Bracelet status updated successfully for member' });
      } else {
        res.status(404).json({ message: 'Bracelet not found' });
      }
    } else if (req.userRole === 'admin') {
      const bracelet = await Bracelet.findById(id_bracelet);

      if (bracelet) {
        bracelet.is_disabled =!bracelet.is_disabled;
        await bracelet.save();
        res.status(200).json({ message: 'Bracelet blocked successfully for admin' });
      } else {
        res.status(404).json({ message: 'Bracelet not found' });
      }
    } else if (req.userRole === 'child') {
      const child = await User.findById(req.userId);
      const bracelet = await Bracelet.findOne({ user: child._id, _id: id_bracelet });

      if (bracelet) {
        bracelet.is_disabled = true;
        await bracelet.save();
        res.status(200).json({ message: 'Bracelet blocked successfully for child' });
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

