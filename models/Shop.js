var mongoose = require('mongoose');
const shop = new mongoose.Schema({
    shop_name: {
      type: String,
      required: true,
    },
    shop_email: {
      type: String,
      required: true,
    },
    shop_adresse:{
      type: String,
      required: true,
    },
    shop_image:{
      type: String,
      required: true,
    },
    shop_phone:{
      type: String,
      required: true,
    },
   
  })
  module.exports = mongoose.model('Shop',shop)