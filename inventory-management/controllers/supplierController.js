const db = require('../database/db');

// Get all suppliers
exports.getSuppliers = async (req, res) => {
  try {
    const suppliers = await db.query('SELECT * FROM supplier ORDER BY name ASC');
    res.json(suppliers);
  } catch (err) {
    console.error('Error fetching suppliers:', err);
    res.status(500).json({ message: 'Error fetching suppliers' });
  }
};

// Add supplier
exports.createSupplier = async (req, res) => {
  const { name, company, phone, email, address } = req.body;

  if (!name || !company || !phone || !email || !address) {
    return res.status(400).json({ message: 'All supplier fields are required' });
  }

  try {
    const result = await db.query(
      'INSERT INTO supplier (name, company, phone, email, address) VALUES (?, ?, ?, ?, ?)',
      [name.trim(), company.trim(), phone.trim(), email.trim(), address.trim()]
    );
    const insertId = result.insertId;

    res.status(201).json({
      id: insertId,
      name: name.trim(),
      company: company.trim(),
      phone: phone.trim(),
      email: email.trim(),
      address: address.trim()
    });
  } catch (err) {
    console.error('Error creating supplier:', err);
    res.status(500).json({ message: 'Error creating supplier' });
  }
};

// Update supplier
exports.updateSupplier = async (req, res) => {
  const { id } = req.params;
  const { name, company, phone, email, address } = req.body;

  if (!name || !company || !phone || !email || !address) {
    return res.status(400).json({ message: 'All supplier fields are required' });
  }

  try {
    const supplier = await db.query('SELECT * FROM supplier WHERE id = ?', [id]);
    if (supplier.length === 0) {
      return res.status(404).json({ message: 'Supplier not found' });
    }

    await db.query(
      'UPDATE supplier SET name = ?, company = ?, phone = ?, email = ?, address = ? WHERE id = ?',
      [name.trim(), company.trim(), phone.trim(), email.trim(), address.trim(), id]
    );

    // Keep product supplier name in sync if updated
    const oldName = supplier[0].name;
    await db.query('UPDATE product SET supplier = ? WHERE supplier = ?', [name.trim(), oldName]);

    res.json({
      id: parseInt(id),
      name: name.trim(),
      company: company.trim(),
      phone: phone.trim(),
      email: email.trim(),
      address: address.trim()
    });
  } catch (err) {
    console.error('Error updating supplier:', err);
    res.status(500).json({ message: 'Error updating supplier' });
  }
};

// Delete supplier
exports.deleteSupplier = async (req, res) => {
  const { id } = req.params;

  try {
    const supplier = await db.query('SELECT * FROM supplier WHERE id = ?', [id]);
    if (supplier.length === 0) {
      return res.status(404).json({ message: 'Supplier not found' });
    }

    await db.query('DELETE FROM supplier WHERE id = ?', [id]);
    res.json({ success: true, message: 'Supplier deleted successfully' });
  } catch (err) {
    console.error('Error deleting supplier:', err);
    res.status(500).json({ message: 'Error deleting supplier' });
  }
};
