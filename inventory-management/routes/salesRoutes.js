const express = require('express');
const router = express.Router();
const salesController = require('../controllers/salesController');

router.get('/', salesController.getSales);
router.get('/:id/items', salesController.getSaleItemsBySaleId);
router.post('/:id/print', salesController.printSale);
router.post('/:id/pdf', salesController.pdfSale);
router.get('/:id', salesController.getSaleById);
router.delete('/:id', salesController.deleteSale);

module.exports = router;
