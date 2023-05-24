const express = require('express');
const router = express.Router();
const professionalController = require('../controllers/professionalController');
const authMiddleware = require('../middleware/authProfessional');
const adminMiddleware = require('../middleware/adminMiddleware');



// Create a new chain
router.post('/chain',adminMiddleware, professionalController.createChain);

// Create a new selling point
router.post('/selling-point',adminMiddleware, professionalController.createSellingPoint);

module.exports = router;