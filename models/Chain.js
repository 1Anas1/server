var mongoose = require('mongoose');


const chain = new mongoose.Schema({
 chain_name :{
    type: String,
    required: true,
  },
chain_email :{
    type: String,
    required: false,
  },
chain_adresse:{
    type: String,
    required: false,
  },
chain_image:{
    type: String,
    required: true,
  },
 chain_phone:{
    type: String,
    required: false,
  },
status:{
    type: String,
    required: true,
  }, 
created_at :{
    type: Date,
    required: true,
    default: Date.now,
  },
updated_at:{
    type: Date,
    required: true,
    default: Date.now,
    
  },
  selling_points: [
    {
      sp_id: { type: mongoose.Schema.Types.ObjectId, ref: 'SellingPoint' },
      sp_name: String
    }
  ],
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
    
    
  })
  module.exports = mongoose.model('Chain',chain)