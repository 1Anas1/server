var mongoose = require('mongoose');

const sellingPointSchema = new mongoose.Schema({
  sp_name: String,
  sp_email: String,
  sp_address: String,
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
    },
    coordinates: {
      type: [Number],
      index: '2dsphere',
    },
  },
  sp_image: String,
  sp_phone: String,
  payment_requirement: String,
  end_contract: Date,
  owner: {type: mongoose.Schema.Types.ObjectId, ref: 'User'},
  chain_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Chain' },
  empl:[{type: mongoose.Schema.Types.ObjectId, ref: 'User'}]
});

module.exports = mongoose.model('SellingPoint', sellingPointSchema);
