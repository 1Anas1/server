var mongoose = require('mongoose');
const Schema = mongoose.Schema;
var Budget =require('./Budget');
const user = new mongoose.Schema({
  firstName: {
    type: String,
    required: true
  },
  lastName: {
    type: String,
    required: true
  },
  username: {
    type: String,
    required: false,
    unique: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  phone: {
    type: String,
    required: false
  },
  image: {
    type: String,
    required: false
  },
  birthDate: {
    type: Date,
    required: false
  },
  created_at: {
    type: Date,
    default: Date.now
  },
  updated_at: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    required: true
  },
  gender: {
    type: String,
    enum: ['Male', 'Female'],
    required: false,
  },
  bracelets: [{
    type: Schema.Types.ObjectId,
    ref: 'Bracelet'
  }],
  chains: [{
    type: Schema.Types.ObjectId,
    ref: 'Chain'
  }],
  shopEmp:{
    type: Schema.Types.ObjectId,
    ref: 'SellingPoint'
  },
  selling_points: [{
    type: Schema.Types.ObjectId,
    ref: 'SellingPoint'
  }],
  parent: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  children: [{
    type: Schema.Types.ObjectId,
    ref: 'User'
  }],
  role: {
    type: Schema.Types.ObjectId,
    ref: 'Role'
  },
  roleEmp:{
    type: String,
    required: true
  }
   
  })
  
  module.exports = mongoose.model('User',user)