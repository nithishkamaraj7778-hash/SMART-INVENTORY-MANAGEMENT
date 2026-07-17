const express = require('express');
const router = express.Router();

const authController = require('../controllers/authController');
const categoryController = require('../controllers/categoryController');
const productController = require('../controllers/productController');
const supplierController = require('../controllers/supplierController');
const dashboardController = require('../controllers/dashboardController');
const predictionController = require('../controllers/predictionController');
const billingRoutes = require('./billingRoutes');
const salesRoutes = require('./salesRoutes');

// Auth
router.post('/login', authController.login);
router.post('/register', authController.register);

// Dashboard
router.get('/dashboard', dashboardController.getDashboardData);
router.get('/dashboard/stats', dashboardController.getDashboardStats);

// Categories CRUD
router.get('/categories', categoryController.getCategories);
router.post('/categories', categoryController.createCategory);
router.put('/categories/:id', categoryController.updateCategory);
router.delete('/categories/:id', categoryController.deleteCategory);

// Products CRUD
router.get('/products', productController.getProducts);
router.post('/products', productController.createProduct);
router.put('/products/:id', productController.updateProduct);
router.delete('/products/:id', productController.deleteProduct);

// Suppliers CRUD
router.get('/suppliers', supplierController.getSuppliers);
router.post('/suppliers', supplierController.createSupplier);
router.put('/suppliers/:id', supplierController.updateSupplier);
router.delete('/suppliers/:id', supplierController.deleteSupplier);

// Prediction
router.get('/prediction', predictionController.getPredictions);

// Billing and sales
router.use('/billing', billingRoutes);
router.use('/sales', salesRoutes);

module.exports = router;
