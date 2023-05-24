const mongoose = require('mongoose');
const { Schema } = mongoose;

const braceletSchema = new Schema({
  
  type: {
    type: String,
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  is_disabled: {
    type: Boolean,
    default: false,
  },
  created_at: {
    type: Date,
    default: Date.now,
  },
  paymentLimit:{
    type: Number,
    default: this.amount,
  },
  max_amount: {
    type: Number,
    required: true,
  },
  duration: {
    type: Number,
    required: true,
  },
  color: {
    type: String,
    required: true,
  },
  payment_method: {
    type: String,
    enum: ['cash on delivery', 'pay online now'],
    required: true,
  },
  delivery_method: {
    type: String,
    enum: ['home delivery', 'poslik office'],
    required: true,
  },
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
  },
  operations:[{
    type: Schema.Types.ObjectId,
    ref: 'Operation',
  }]
});

const Bracelet = mongoose.model('Bracelet', braceletSchema);

module.exports = Bracelet;
