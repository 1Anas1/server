const mongoose = require('mongoose');

// Create a new family schema
const familySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Family',
    required: true
  }
});

// Create a new category schema
const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  }
});

// Create a new product schema
const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  family: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Family',
    required: true
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true
  },price: {
    type: Number,
    required: true
  },
  description: String,
});

// Create the Family model
const Family = mongoose.model('Family', familySchema);

// Create the Category model
const Category = mongoose.model('Category', categorySchema);

// Create the Product model
const Product = mongoose.model('Product', productSchema);

module.exports = {
  Family,
  Category,
  Product
};
