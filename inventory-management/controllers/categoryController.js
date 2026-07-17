const db = require('../database/db');

// Get all categories
exports.getCategories = async (req, res) => {
  try {
    const categories = await db.query('SELECT * FROM category ORDER BY name ASC');
    res.json(categories);
  } catch (err) {
    console.error('Error fetching categories:', err);
    res.status(500).json({ message: 'Error fetching categories' });
  }
};

// Add category
exports.createCategory = async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ message: 'Category name is required' });
  }

  const categoryName = name.trim();

  try {
    // Check if duplicate exists
    const existing = await db.query('SELECT * FROM category WHERE name = ?', [categoryName]);
    if (existing.length > 0) {
      return res.status(400).json({ message: 'Category name already exists' });
    }

    const result = await db.query('INSERT INTO category (name) VALUES (?)', [categoryName]);
    const insertId = result.insertId;

    res.status(201).json({ id: insertId, name: categoryName });
  } catch (err) {
    console.error('Error creating category:', err);
    res.status(500).json({ message: 'Error creating category' });
  }
};

// Update category
exports.updateCategory = async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ message: 'Category name is required' });
  }

  const categoryName = name.trim();

  try {
    // Check if ID exists
    const category = await db.query('SELECT * FROM category WHERE id = ?', [id]);
    if (category.length === 0) {
      return res.status(404).json({ message: 'Category not found' });
    }

    // Check if duplicate exists with another category
    const duplicate = await db.query('SELECT * FROM category WHERE name = ? AND id != ?', [categoryName, id]);
    if (duplicate.length > 0) {
      return res.status(400).json({ message: 'Category name already exists' });
    }

    // Perform Update
    await db.query('UPDATE category SET name = ? WHERE id = ?', [categoryName, id]);

    // Also update products using this category to keep consistency
    const oldName = category[0].name;
    await db.query('UPDATE product SET category = ? WHERE category = ?', [categoryName, oldName]);

    res.json({ id: parseInt(id), name: categoryName });
  } catch (err) {
    console.error('Error updating category:', err);
    res.status(500).json({ message: 'Error updating category' });
  }
};

// Delete category
exports.deleteCategory = async (req, res) => {
  const { id } = req.params;

  try {
    const category = await db.query('SELECT * FROM category WHERE id = ?', [id]);
    if (category.length === 0) {
      return res.status(404).json({ message: 'Category not found' });
    }

    await db.query('DELETE FROM category WHERE id = ?', [id]);
    res.json({ success: true, message: 'Category deleted successfully' });
  } catch (err) {
    console.error('Error deleting category:', err);
    res.status(500).json({ message: 'Error deleting category' });
  }
};
