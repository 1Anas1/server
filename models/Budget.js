var mongoose = require('mongoose');
const Budget = new mongoose.Schema({
    name: {
      type: String,
      required: true,
    },
    amount: {
      type: String,
      required: true,
    },
    image:{
      type: String,
      required: true,
    },
    date:{
      type: String,
      required: true,
    }
   
  })
  module.exports = mongoose.model('Budget',Budget)