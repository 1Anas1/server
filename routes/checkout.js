const express = require('express');
const router = express.Router();

const checkoutController = require('../controllers/checkoutController');

// Route to add a family


const checkoutRoute = (io) => {
    // Your middleware logic here if needed
    
    // Route to add a family
router.post('/family', checkoutController.addFamily);

// Route to add a category
router.post('/category', checkoutController.addCategory);

// Route to add a product
router.post('/product', checkoutController.addProduct);
    router.post('/payment', (req, res) => { 
        checkoutController.payment(req, res,io)
      });
  
    return router;
  };
  
  module.exports = checkoutRoute;