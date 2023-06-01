const mongoose = require('mongoose');

const limitsSchema = new mongoose.Schema({
  bracelet: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bracelet',
    required: true,
  },
  restrictedshop:{type: mongoose.Schema.Types.ObjectId,
    ref: 'Chain',},
  restrictedProducts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
  }]
});

module.exports = mongoose.model('Limits', limitsSchema);
