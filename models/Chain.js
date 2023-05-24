var mongoose = require('mongoose');


const chain = new mongoose.Schema({
 chain_name :{
    type: String,
    required: true,
  },
chain_email :{
    type: String,
    required: true,
  },
chain_adresse:{
    type: String,
    required: true,
  },
chain_image:{
    type: String,
    required: true,
  },
 chain_phone:{
    type: String,
    required: true,
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
  ]
    
    
  })
  module.exports = mongoose.model('Chain',chain)