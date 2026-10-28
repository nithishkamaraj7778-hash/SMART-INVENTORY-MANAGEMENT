const db = require('../database/db');
const { validateProductPayload } = require('../lib/inventoryLogic');

// Get all products
exports.getProducts = async (req, res) => {
  try {
    const products = await db.query('SELECT * FROM product ORDER BY name ASC');
    res.json(products);
  } catch (err) {
    console.error('Error fetching products:', err);
    res.status(500).json({ message: 'Error fetching products' });
  }
};

// Add product
exports.createProduct = async (req, res) => {
  const validation = validateProductPayload(req.body);
  if (!validation.valid) {
    return res.status(400).json({ message: validation.message });
  }

  try {
    const result = await db.query(
      `INSERT INTO product (name, category, supplier, price, gst, quantity, minimum, maximum, avg_daily_sales) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        validation.normalized.name,
        validation.normalized.category,
        validation.normalized.supplier,
        validation.normalized.price,
        validation.normalized.gst,
        validation.normalized.quantity,
        validation.normalized.minimum,
        validation.normalized.maximum,
        validation.normalized.avg_daily_sales
      ]
    );

    const insertId = result.insertId;
    res.status(201).json({
      id: insertId,
      ...validation.normalized
    });
  } catch (err) {
    console.error('Error creating product:', err);
    res.status(500).json({ message: 'Error creating product' });
  }
};

// Update product
exports.updateProduct = async (req, res) => {
  const { id } = req.params;
  const validation = validateProductPayload(req.body);
  if (!validation.valid) {
    return res.status(400).json({ message: validation.message });
  }

  try {
    const product = await db.query('SELECT * FROM product WHERE id = ?', [id]);
    if (product.length === 0) {
      return res.status(404).json({ message: 'Product not found' });
    }

    await db.query(
      `UPDATE product 
       SET name = ?, category = ?, supplier = ?, price = ?, gst = ?, quantity = ?, minimum = ?, maximum = ?, avg_daily_sales = ? 
       WHERE id = ?`,
      [
        validation.normalized.name,
        validation.normalized.category,
        validation.normalized.supplier,
        validation.normalized.price,
        validation.normalized.gst,
        validation.normalized.quantity,
        validation.normalized.minimum,
        validation.normalized.maximum,
        validation.normalized.avg_daily_sales,
        id
      ]
    );

    res.json({
      id: parseInt(id, 10),
      ...validation.normalized
    });
  } catch (err) {
    console.error('Error updating product:', err);
    res.status(500).json({ message: 'Error updating product' });
  }
};

// Delete product
exports.deleteProduct = async (req, res) => {
  const { id } = req.params;

  try {
    const product = await db.query('SELECT * FROM product WHERE id = ?', [id]);
    if (product.length === 0) {
      return res.status(404).json({ message: 'Product not found' });
    }

    await db.query('DELETE FROM product WHERE id = ?', [id]);
    res.json({ success: true, message: 'Product deleted successfully' });
  } catch (err) {
    console.error('Error deleting product:', err);
    res.status(500).json({ message: 'Error deleting product' });
  }
};
