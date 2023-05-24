const mongoose = require('mongoose');

const limitsSchema = new mongoose.Schema({
  bracelet: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bracelet',
    required: true,
  },
  restrictedProducts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
  }],
  restrictedFamilies: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Family',
  }],
  restrictedCategories: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
  }],
});

module.exports = mongoose.model('Limits', limitsSchema);
