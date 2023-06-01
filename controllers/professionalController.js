const Chain = require('../models/Chain');
const SellingPoint = require('../models/sellingPoint');
const User = require('../models/User');const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const Role = require("../models/Role");
const mongoose = require('mongoose');
exports.createChain = async function(req, res) {
  try {
    // Vérifie si la chaîne existe déjà
    const existingChain = await Chain.findOne({ chain_name: req.body.chain_name });
    if (existingChain) {
      return res.status(400).send('Chain already exists.');
    }

    // Crée la nouvelle chaîne
    const chain = new Chain({
      chain_name: req.body.chain_name,
      chain_email: req.body.chain_email,
      chain_adresse: req.body.chain_adresse,
      chain_image: req.body.chain_image,
      chain_phone: req.body.chain_phone,
      status: req.body.status
    });
    
    const existingUser = await User.findById(req.body.owner_id);
    
    if (!existingUser) {
      return res.status(400).send('User not exists.');
    }
    
    // Ajoute l'utilisateur en tant que propriétaire de la chaîne
    existingUser.chains.push(req.body.owner_id);
    

    // Sauvegarde la chaîne dans la base de données
    await chain.save();
    await existingUser.save();
    console.log('5');
    res.status(200).send(chain);
  } catch (ex) {
    console.log(ex);
    res.status(500).send('An error occurred while creating the chain.');
  }
};

exports.createSellingPoint = async (req, res) => {
  const {
    name_shop,
    email,
    phone_number,
    location,
    status_shop,
    owner,
    chain,
    position,
  } = req.body;

  // Check if all required fields are provided
  if (
    !name_shop ||
    !email ||
    !phone_number ||
    !location ||
    !status_shop ||
    !owner ||
    !chain ||
    !position ||
    !position.lat ||
    !position.lng
  ) {
    return res.status(400).json({ message: "All fields must be filled out" });
  }

  const emailRegex = /^\S+@\S+\.\S+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ message: "Email is not valid" });
  }

  // Create a new SellingPoint
  const sellingPoint = new SellingPoint({
    sp_name: name_shop,
    sp_email: email,
    sp_phone: phone_number,
    sp_address: location,
    payment_requirement: status_shop,
    owner: owner,
    location: {
      type: "Point",
      coordinates: [position.lng, position.lat], // longitude should be first in GeoJSON
    },
    chain_id: chain,
  });
 console.log(sellingPoint)
  try {
    const savedSellingPoint = await sellingPoint.save();
    console.log(1);
    // Find the chain and add the new SellingPoint
    const foundChain = await Chain.findById(chain);
    if (!foundChain) {
      return res.status(404).json({ message: "Chain not found" });
    }console.log(12);
    foundChain.selling_points.push({
      sp_id: savedSellingPoint._id,
      sp_name: savedSellingPoint.sp_name,
    });
    await foundChain.save();
    console.log(3);
    // Find the user and add the new SellingPoint
    const foundUser = await User.findById(owner);
    if (!foundUser) {
      return res.status(404).json({ message: "User not found" });
    }
    foundUser.selling_points.push(savedSellingPoint._id);
    await foundUser.save();

    // Find the owner of the chain and add the owner of the selling point as a child
    const chainOwner = await User.findById(foundChain.owner);
    if (!chainOwner) {
      return res.status(404).json({ message: "Chain owner not found" });
    }
    chainOwner.children.push(owner);
    await chainOwner.save();

    res.status(201).json(savedSellingPoint);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};




//sign in admin et pro
exports.signin = async (req, res,io) => {
  const { email, password } = req.body;

  // Check if user with given email and role "member" exists
  const existingUser = await User.findOne({ email }).populate({
    path: "role",
    match: { $or: [{ name: "admin" }, { name: "professional" }] },
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
    
  );
  role =existingUser.role.name;
  res.status(200).json({ token, role});
};


exports.getSellingPointsByChainId = async (req, res) => {
  try {
    const chainId = req.params.chainId; // Assuming the chain ID is passed as a route parameter
    const sellingPoints = await SellingPoint.find({ chain_id: chainId });

    res.json(sellingPoints);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
exports.getSellingPoints = async (req, res) => {
  try {
    
    const sellingPoints = await SellingPoint.find()

    res.json(sellingPoints);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
exports.getSellingPointInfo = async (req, res) => {
  const { id } = req.params; // Assuming you're passing the ID in the URL

  // Find the selling point with the provided ID
  try {
    const sellingPoint = await SellingPoint.findById(id);
    if (!sellingPoint) {
      return res.status(404).json({ message: "Selling point not found" });
    }

    // If the selling point exists, return its data
    res.status(200).json({
      name_shop: sellingPoint.sp_name,
      email: sellingPoint.sp_email,
      phone_number: sellingPoint.sp_phone,
      location: sellingPoint.sp_address,
      status_shop: sellingPoint.payment_requirement,
      owner: sellingPoint.owner,
      chain: sellingPoint.chain_id,
      position: {
        lat: sellingPoint.location.coordinates[1],
        lng: sellingPoint.location.coordinates[0],
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
exports.editShop = async (req, res) => {
  try {
    const { id, name_shop, email, phone_number, location, status_shop, owner, chain, position } = req.body;

    // Find the existing shop by ID
    const shop = await SellingPoint.findById(id);
    if (!shop) {
      return res.status(404).json({ error: 'Shop not found' });
    }

    // Update the shop properties
    shop.sp_name = name_shop;
    shop.sp_email = email;
    shop.sp_phone = phone_number;
    shop.sp_address = location;
    shop.payment_requirement = status_shop;
    shop.owner = owner;
    shop.chain_id = chain;
    shop.location.coordinates = [position.lng, position.lat];

    // Update the update_at property
    shop.updated_at = Date.now();

    // Save the updated shop
    await shop.save();

    res.json({ message: 'Shop updated successfully', shop });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
};

