const User = require('../models/User');
const Chain = require('../models/Chain');

const { validationResult } = require('express-validator');
const dotenv = require("dotenv");

dotenv.config()

// Create a new chain
const createChain = async (req, res) => {
  try {
    const { chain_name, chain_email, chain_address, chain_image, chain_phone } = req.body;

    // Verify that the current user has a professional account
    const currentUser = await User.findById(req.user.id);
    if (currentUser.role.name !== 'professional') {
      return res.status(401).json({ error: 'You must have a professional account to create a chain' });
    }

    // Verify that a chain with the given name doesn't already exist
    const existingChain = await Chain.findOne({ chain_name });
    if (existingChain) {
      return res.status(409).json({ error: 'A chain with this name already exists' });
    }

    // Create a new chain
    const chain = new Chain({
      chain_name,
      chain_email,
      chain_address,
      chain_image,
      chain_phone,
      status: 'active'
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
    const chain = await Chain.findById(id).populate('selling_points');
    if (!chain) {
      return res.status(404).json({ error: 'Chain not found' });
    }

    res.status(200).json({ chain });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = {
  createChain,
  getAllChains,
  getChainById
};

