var mongoose = require('mongoose');
const Permission = new mongoose.Schema({
    type: {
      type: String,
      required: true,
    },
   
  })
  module.exports = mongoose.model('Permission',Permission)