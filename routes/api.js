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
const { requireAuth } = require('../middleware/authMiddleware');

// ── Authentication ──────────────────────────────────────────────────────────
router.post('/login', authController.login);
router.post('/register', authController.register);
router.get('/auth/me', requireAuth, authController.me);
router.post('/auth/logout', requireAuth, authController.logout);

router.use(requireAuth);

// ── Dashboard ───────────────────────────────────────────────────────────────
router.get('/dashboard', dashboardController.getDashboardData);
router.get('/dashboard/stats', dashboardController.getDashboardStats);

// ── Categories ──────────────────────────────────────────────────────────────
router.get('/categories', categoryController.getCategories);
router.post('/categories', categoryController.createCategory);
router.put('/categories/:id', categoryController.updateCategory);
router.delete('/categories/:id', categoryController.deleteCategory);

// ── Products ────────────────────────────────────────────────────────────────
router.get('/products', productController.getProducts);
router.post('/products', productController.createProduct);
router.put('/products/:id', productController.updateProduct);
router.delete('/products/:id', productController.deleteProduct);

// ── Suppliers ───────────────────────────────────────────────────────────────
router.get('/suppliers', supplierController.getSuppliers);
router.post('/suppliers', supplierController.createSupplier);
router.put('/suppliers/:id', supplierController.updateSupplier);
router.delete('/suppliers/:id', supplierController.deleteSupplier);

// ── Predictive Restocking ───────────────────────────────────────────────────
router.get('/prediction', predictionController.getPredictions);

// ── Billing & Sales ───────────────────────────────────────────────────────────
router.use('/billing', billingRoutes);
router.use('/sales', salesRoutes);

module.exports = router;
