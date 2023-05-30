const express = require('express');
const router = express.Router();
const professionalController = require('../controllers/professionalController');
const authMiddleware = require('../middleware/authProfessional');
const adminMiddleware = require('../middleware/adminMiddleware');
const userController = require('../controllers/user');
const chainContoller = require('../controllers/chain');

router.get('/getAllChains',adminMiddleware,chainContoller.getAllChains);

router.get('/getSellingPointsByChainId/:chainId',professionalController.getSellingPointsByChainId);
router.get('/getSellingPoints',professionalController.getSellingPoints);
router.get('/getChainById/:id',chainContoller.getChainById);
// Create a new chain
router.post('/chain',adminMiddleware, professionalController.createChain);

// Create a new selling point
router.post('/selling-point',adminMiddleware, professionalController.createSellingPoint);
router.post('/signin', professionalController.signin);
router.get('/getAllUser',authMiddleware.checkProfessionalAccount, userController.GetAllUser);
module.exports = router;