var mongoose = require('mongoose');
const sellingPointSchema = new mongoose.Schema({
    sp_name: String,
    sp_email: String,
    sp_address: String,
    sp_latitude: Number,
    sp_longitude: Number,
    sp_image: String,
    sp_phone: String,
    payment_requirement: String,
    end_contract: Date,
    chain_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Chain' }
  });
  
  module.exports = mongoose.model('SellingPoint', sellingPointSchema);