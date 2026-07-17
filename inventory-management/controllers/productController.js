const db = require('../database/db');

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
  const { name, category, supplier, price, quantity, minimum, maximum, avg_daily_sales, gst } = req.body;

  if (!name || !category || !supplier || price === undefined || quantity === undefined || minimum === undefined || maximum === undefined || avg_daily_sales === undefined) {
    return res.status(400).json({ message: 'All product fields are required' });
  }

  try {
    const result = await db.query(
      `INSERT INTO product (name, category, supplier, price, gst, quantity, minimum, maximum, avg_daily_sales) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name.trim(),
        category,
        supplier,
        parseFloat(price),
        Number.isFinite(Number(gst)) ? Number(gst) : 0,
        parseInt(quantity),
        parseInt(minimum),
        parseInt(maximum),
        parseFloat(avg_daily_sales)
      ]
    );

    const insertId = result.insertId;
    res.status(201).json({
      id: insertId,
      name: name.trim(),
      category,
      supplier,
      price: parseFloat(price),
      gst: Number.isFinite(Number(gst)) ? Number(gst) : 0,
      quantity: parseInt(quantity),
      minimum: parseInt(minimum),
      maximum: parseInt(maximum),
      avg_daily_sales: parseFloat(avg_daily_sales)
    });
  } catch (err) {
    console.error('Error creating product:', err);
    res.status(500).json({ message: 'Error creating product' });
  }
};

// Update product
exports.updateProduct = async (req, res) => {
  const { id } = req.params;
  const { name, category, supplier, price, quantity, minimum, maximum, avg_daily_sales, gst } = req.body;

  if (!name || !category || !supplier || price === undefined || quantity === undefined || minimum === undefined || maximum === undefined || avg_daily_sales === undefined) {
    return res.status(400).json({ message: 'All product fields are required' });
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
        name.trim(),
        category,
        supplier,
        parseFloat(price),
        Number.isFinite(Number(gst)) ? Number(gst) : 0,
        parseInt(quantity),
        parseInt(minimum),
        parseInt(maximum),
        parseFloat(avg_daily_sales),
        id
      ]
    );

    res.json({
      id: parseInt(id),
      name: name.trim(),
      category,
      supplier,
      price: parseFloat(price),
      gst: Number.isFinite(Number(gst)) ? Number(gst) : 0,
      quantity: parseInt(quantity),
      minimum: parseInt(minimum),
      maximum: parseInt(maximum),
      avg_daily_sales: parseFloat(avg_daily_sales)
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
