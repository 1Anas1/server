// Operation.js
const mongoose = require('mongoose');

const operationSchema = new mongoose.Schema({
    type:{
        type:String,
        required:true,
    },
  bracelet: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bracelet',
    required: true,
  },
  sellingPoint: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SellingPoint',
    required: false,
  },
  approved: {
    type: Boolean,
    default: false,
  },
  amount: {
    type: Number,
    required: true,
  },
  date: {
    type: Date,
    default: Date.now,
  },
  operationLines:[{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'OperationLine',
  }]
});

module.exports = mongoose.model('Operation', operationSchema);
