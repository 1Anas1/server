var mongoose = require('mongoose');
var Permission =require('./Permission');
var Role =require('./Role');
const RolePermission = new mongoose.Schema({
    type: {
      type: String,
      required: true,
    },
    role:Role,
    Permission:Permission

   
  })
  module.exports = mongoose.model('RolePermission',RolePermission)