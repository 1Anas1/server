// OperationLine.js
const mongoose = require('mongoose');

const operationLineSchema = new mongoose.Schema({
  operation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Operation',
    required: true,
  },
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
  },
  cost: {
    type: Number,
    required: true,
  }
});

module.exports = mongoose.model('OperationLine', operationLineSchema);
