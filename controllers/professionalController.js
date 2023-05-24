const Chain = require('../models/chain');
const SellingPoint = require('../models/sellingPoint');
const User = require('../models/User');

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

exports.createSellingPoint = async function(req, res) {
  try {
    // Vérifie si le point de vente existe déjà
    const existingSellingPoint = await SellingPoint.findOne({ sp_name: req.body.sp_name });
    if (existingSellingPoint) {

        return res.status(400).send('Selling point already exists.');
    }

    // Crée le nouveau point de vente
    const sellingPoint = new SellingPoint({
      sp_name: req.body.sp_name,
      sp_email: req.body.sp_email,
      sp_address: req.body.sp_address,
      sp_latitude: req.body.sp_latitude,
      sp_longitude: req.body.sp_longitude,
      sp_image: req.body.sp_image,
      sp_phone: req.body.sp_phone,
      payment_requirement: req.body.payment_requirement,
      end_contract: req.body.end_contract,
      chain_id: req.body.chain_id
    });
    
    const existingChain = await Chain.findById( req.body.chain_id );
    if (!existingChain) {
      return res.status(400).send('Chain not exists.');
    }
    await sellingPoint.save();
    // Ajoute l'utilisateur en tant que propriétaire du point de vente
    existingChain.selling_points.push(req.body.chain_id);

    // Sauvegarde le point de vente dans la base de données
   
    await existingChain.save();
    const existingUser = await User.findById(req.body.owner_id);
    
    if (!existingUser) {
      return res.status(400).send('User not exists.');
    }
    
    // Ajoute l'utilisateur en tant que propriétaire de la chaîne
    existingUser.selling_points.push(existingChain._id);
    await existingUser.save();
    

    res.status(200).send(sellingPoint);
  } catch (ex) {
    console.log(ex);
    res.status(500).send('An error occurred while creating the selling point.');
  }
};
