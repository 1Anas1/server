const User = require('../models/User');
const Chain = require('../models/Chain');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { validationResult } = require('express-validator');
const dotenv = require("dotenv");

dotenv.config()

// Create a new chain
const createChain = async (req, res) => {
  try {
    const { chain_name, chain_image, ownerId } = req.body;

    // Verify that the current user has a professional account
    const currentUser = await User.findById(ownerId).populate('role');
    console.log(currentUser);
    if (currentUser.role.name !== 'professional') {
      return res.status(401).json({ error: 'You must have a professional account to create a chain' });
    }

    // Verify that a chain with the given name doesn't already exist
    const existingChain = await Chain.findOne({ chain_name });
    if (existingChain) {
      return res.status(409).json({ error: 'A chain with this name already exists' });
    }

    // Decode the base64 image and save it to the "uploads" folder
    const matches = chain_image.match(/^data:image\/([a-zA-Z+]+);base64,(.+)$/);
    const fileExtension = matches[1];
    const base64Data = matches[2];
    const imageBuffer = Buffer.from(base64Data, 'base64');
    const imageName = `${Date.now()}.${fileExtension}`; // Generate a unique name with the correct file extension
    const imagePath = path.join(__dirname, '../uploads', imageName);
    fs.writeFileSync(imagePath, imageBuffer);

    // Create a new chain
    const chain = new Chain({
      chain_name,
      chain_image: imageName,
      status: 'active',
      owner: ownerId
    });

    // Add the chain to the current user's chains array
    currentUser.chains.push(chain);

    // Save the chain and the current user
    await chain.save();
    await currentUser.save();

    res.status(201).json({ message: 'Chain created successfully', chain });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
};

const editChain = async (req, res) => {
  try {
    const { chain_id, chain_name, chain_image } = req.body;

   

    // Find the existing chain by ID
    const chain = await Chain.findById(chain_id);
    if (!chain) {
      return res.status(404).json({ error: 'Chain not found' });
    }

    // Update the chain properties
    chain.chain_name = chain_name;
    chain.updated_at = Date.now();

    // Check if there is a new chain image provided
    if (chain_image) {
      // Decode the base64 image and save it to the "uploads" folder
      const matches = chain_image.match(/^data:image\/([a-zA-Z+]+);base64,(.+)$/);
      const fileExtension = matches[1];
      const base64Data = matches[2];
      const imageBuffer = Buffer.from(base64Data, 'base64');
      const imageName = `${Date.now()}.${fileExtension}`; // Generate a unique name with the correct file extension
      const imagePath = path.join(__dirname, '../uploads', imageName);
      fs.writeFileSync(imagePath, imageBuffer);

      // Update the chain image
      chain.chain_image = imageName;
    }

    // Save the updated chain
    await chain.save();

    res.json({ message: 'Chain updated successfully', chain });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Get all chains
const getAllChains = async (req, res) => {
  try {
    // Find all chains and populate the selling points array for each chain with their details
    const chains = await Chain.find().populate(
      'selling_points'
    ).populate('owner');

    res.status(200).json({ chains });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Get a single chain by ID
const getChainById = async (req, res) => {
  try {
    const { id } = req.params;

    // Verify that the chain exists
    const chain = await Chain.findById(id).populate('selling_points').populate('owner');
    if (!chain) {
      return res.status(404).json({ error: 'Chain not found' });
    }

    res.status(200).json({ chain });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }

};
const getChains = async (req, res) => {
  try {
    const chains = await Chain.find({}, 'chain_name'); // This will only return the _id and chain_name of each document
    res.status(200).json(chains);
  } catch (error) {
    res.status(500).json({ message: 'Failed to get chains', error });
  }
};

module.exports = {
  createChain,
  getAllChains,
  getChainById,
  editChain,
  getChains
};

