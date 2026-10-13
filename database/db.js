const mysql = require('mysql2/promise');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

let connectionPool = null;
let sqliteDb = null;
let dbType = 'sqlite'; // Default fallback

// DB config from environment variables
const DB_HOST = process.env.DB_HOST || process.env.MYSQLHOST || 'localhost';
const DB_USER = process.env.DB_USER || process.env.MYSQLUSER || 'root';
const DB_PASSWORD = process.env.DB_PASSWORD || process.env.MYSQLPASSWORD || '';
const DB_NAME = process.env.DB_NAME || process.env.MYSQLDATABASE || 'inventory_db';
const DB_PORT = Number(process.env.DB_PORT || process.env.MYSQLPORT) || 3306;

async function initializeDatabase() {
  try {
    console.log('[Database] Attempting to connect to MySQL...');
    // Railway provisions the configured database and may not grant CREATE DATABASE.
    if (!process.env.MYSQLHOST) {
      const tempConnection = await mysql.createConnection({
        host: DB_HOST,
        port: DB_PORT,
        user: DB_USER,
        password: DB_PASSWORD
      });

      await tempConnection.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\`;`);
      await tempConnection.end();
    }

    // Now establish connection pool with the database
    connectionPool = mysql.createPool({
      host: DB_HOST,
      port: DB_PORT,
      user: DB_USER,
      password: DB_PASSWORD,
      database: DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });

    // Test connection
    const conn = await connectionPool.getConnection();
    console.log('[Database] MySQL connected successfully!');
    conn.release();
    dbType = 'mysql';

    // Run schema creation for MySQL
    await setupMySQLSchema();
    await query('DELETE FROM auth_sessions WHERE expires_at <= ?', [Date.now()]);
    // Ensure product table has gst column even if DB was created earlier
    await ensureProductGstColumn();
  } catch (err) {
    console.warn(`[Database] MySQL connection failed: ${err.message}`);
    if ((process.env.NODE_ENV === 'production' || process.env.VERCEL) && process.env.ALLOW_SQLITE_FALLBACK !== 'true') {
      throw new Error('MySQL is required in production. Set ALLOW_SQLITE_FALLBACK=true only for temporary demo deployments.');
    }
    console.warn('[Database] Falling back to SQLite database...');
    dbType = 'sqlite';
    await setupSQLite();
    // Ensure product table has gst column even if DB was created earlier
    await ensureProductGstColumn();
  }
}

async function ensureProductGstColumn() {
  try {
    if (dbType === 'mysql') {
      // Add column if missing (MySQL)
      await connectionPool.query("ALTER TABLE product ADD COLUMN IF NOT EXISTS `gst` DECIMAL(5,2) NOT NULL DEFAULT 0;");
    } else if (sqliteDb) {
      // Check if gst column exists in SQLite product table
      const row = await new Promise((resolve, reject) => {
        sqliteDb.get("PRAGMA table_info(product)", (err, r) => {
          if (err) reject(err);
          else resolve(r);
        });
      }).catch(() => null);

      // If PRAGMA returned rows, inspect full table info
      if (row) {
        const cols = await new Promise((resolve, reject) => {
          const all = [];
          sqliteDb.each("PRAGMA table_info(product)", (err, r) => {
            if (err) reject(err);
            else all.push(r);
          }, (e, c) => {
            if (e) reject(e);
            else resolve(all);
          });
        });

        const hasGst = cols.some(c => c.name === 'gst');
        if (!hasGst) {
          await query('ALTER TABLE product ADD COLUMN gst REAL NOT NULL DEFAULT 0');
        }
      }
    }
  } catch (err) {
    console.warn('[Database] ensureProductGstColumn failed:', err.message || err);
  }
}

async function setupMySQLSchema() {
  const queries = [
    `CREATE TABLE IF NOT EXISTS \`admin\` (
      \`id\` INT AUTO_INCREMENT PRIMARY KEY,
      \`username\` VARCHAR(50) UNIQUE NOT NULL,
      \`password\` VARCHAR(255) NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS \`auth_sessions\` (
      \`token_hash\` CHAR(64) PRIMARY KEY,
      \`user_id\` INT NOT NULL,
      \`username\` VARCHAR(50) NOT NULL,
      \`expires_at\` BIGINT NOT NULL,
      INDEX \`idx_auth_sessions_expires_at\` (\`expires_at\`)
    );`,
    `CREATE TABLE IF NOT EXISTS \`category\` (
      \`id\` INT AUTO_INCREMENT PRIMARY KEY,
      \`name\` VARCHAR(100) UNIQUE NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS \`supplier\` (
      \`id\` INT AUTO_INCREMENT PRIMARY KEY,
      \`name\` VARCHAR(100) NOT NULL,
      \`company\` VARCHAR(100) NOT NULL,
      \`phone\` VARCHAR(50) NOT NULL,
      \`email\` VARCHAR(100) NOT NULL,
      \`address\` TEXT NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS \`product\` (
      \`id\` INT AUTO_INCREMENT PRIMARY KEY,
      \`name\` VARCHAR(100) NOT NULL,
      \`category\` VARCHAR(100) NOT NULL,
      \`supplier\` VARCHAR(100) NOT NULL,
      \`price\` DECIMAL(10,2) NOT NULL,\
      \`gst\` DECIMAL(5,2) NOT NULL DEFAULT 0,\
      \`quantity\` INT NOT NULL,
      \`minimum\` INT NOT NULL,
      \`maximum\` INT NOT NULL,
      \`avg_daily_sales\` DECIMAL(10,2) NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS \`sales\` (
      \`id\` INT AUTO_INCREMENT PRIMARY KEY,
      \`invoice_number\` VARCHAR(50) UNIQUE NOT NULL,
      \`customer_name\` VARCHAR(100) DEFAULT '',
      \`customer_phone\` VARCHAR(50) DEFAULT '',
      \`payment_method\` VARCHAR(20) NOT NULL,
      \`subtotal\` DECIMAL(10,2) NOT NULL,
      \`discount\` DECIMAL(10,2) NOT NULL DEFAULT 0,
      \`gst\` DECIMAL(10,2) NOT NULL DEFAULT 0,
      \`grand_total\` DECIMAL(10,2) NOT NULL,
      \`cash_received\` DECIMAL(10,2) NOT NULL DEFAULT 0,
      \`balance\` DECIMAL(10,2) NOT NULL DEFAULT 0,
      \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP
    );`,
    `CREATE TABLE IF NOT EXISTS \`sale_items\` (
      \`id\` INT AUTO_INCREMENT PRIMARY KEY,
      \`sale_id\` INT NOT NULL,
      \`product_id\` INT NOT NULL,
      \`product_name\` VARCHAR(100) NOT NULL,
      \`price\` DECIMAL(10,2) NOT NULL,
      \`quantity\` INT NOT NULL,
      \`gst\` DECIMAL(10,2) NOT NULL DEFAULT 0,
      \`discount\` DECIMAL(10,2) NOT NULL DEFAULT 0,
      \`subtotal\` DECIMAL(10,2) NOT NULL,
      FOREIGN KEY (\`sale_id\`) REFERENCES \`sales\`(\`id\`) ON DELETE CASCADE
    );`
  ];

  for (const q of queries) {
    await connectionPool.query(q);
  }

  // Seed default admin
  await connectionPool.query(
    `INSERT INTO \`admin\` (\`username\`, \`password\`) 
     SELECT 'admin', 'admin123' WHERE NOT EXISTS (SELECT 1 FROM \`admin\` WHERE \`username\` = 'admin');`
  );

  // Seed categories if empty
  const [cats] = await connectionPool.query('SELECT COUNT(*) as count FROM \`category\`');
  if (cats[0].count === 0) {
    await connectionPool.query(
      `INSERT INTO \`category\` (\`name\`) VALUES ('Dairy'), ('Grains'), ('Beverages'), ('Snacks');`
    );
  }

  // Seed suppliers if empty
  const [sups] = await connectionPool.query('SELECT COUNT(*) as count FROM \`supplier\`');
  if (sups[0].count === 0) {
    await connectionPool.query(
      `INSERT INTO \`supplier\` (\`name\`, \`company\`, \`phone\`, \`email\`, \`address\`) VALUES 
       ('John Doe', 'Dairy Fresh Corp', '9876543210', 'john@dairyfresh.com', '123 Milk Way, Dairy City'),
       ('Jane Smith', 'Golden Grains Co', '9876543211', 'jane@goldengrains.com', '456 Wheat Fields, Grain Valley'),
       ('Bob Johnson', 'Beverage King', '9876543212', 'bob@bevking.com', '789 Soda Springs, Drink Town');`
    );
  }

  // Seed products if empty
  const [prods] = await connectionPool.query('SELECT COUNT(*) as count FROM \`product\`');
  if (prods[0].count === 0) {
    await connectionPool.query(
       `INSERT INTO \`product\` (\`name\`, \`category\`, \`supplier\`, \`price\`, \`gst\`, \`quantity\`, \`minimum\`, \`maximum\`, \`avg_daily_sales\`) VALUES 
         ('Fresh Milk 1L', 'Dairy', 'John Doe', 60.00, 5.00, 50, 20, 100, 5.00),
         ('Organic Butter 500g', 'Dairy', 'John Doe', 250.00, 12.00, 12, 15, 50, 3.00),
         ('White Rice 5kg', 'Grains', 'Jane Smith', 350.00, 0.00, 0, 10, 80, 2.50),
         ('Cola 500ml', 'Beverages', 'Bob Johnson', 40.00, 18.00, 100, 30, 200, 12.00),
         ('Potato Chips 100g', 'Snacks', 'Jane Smith', 20.00, 18.00, 150, 25, 250, 6.00),
         ('Apple Juice 1L', 'Beverages', 'Bob Johnson', 110.00, 12.00, 5, 10, 40, 2.00);`
    );
  }
}

function setupSQLite() {
  return new Promise((resolve, reject) => {
    const dbPath = process.env.SQLITE_DATABASE_PATH || path.join(__dirname, 'inventory.db');
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    
    sqliteDb = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error(`[Database] SQLite open error: ${err.message}`);
        return reject(err);
      }
      console.log(`[Database] SQLite database opened at: ${dbPath}`);
      
      sqliteDb.serialize(() => {
        // Create tables
        sqliteDb.run(`
          CREATE TABLE IF NOT EXISTS admin (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL
          )
        `);

        sqliteDb.run(`
          CREATE TABLE IF NOT EXISTS auth_sessions (
            token_hash TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL,
            username TEXT NOT NULL,
            expires_at INTEGER NOT NULL
          )
        `);
        
        sqliteDb.run(`
          CREATE TABLE IF NOT EXISTS category (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL
          )
        `);
        
        sqliteDb.run(`
          CREATE TABLE IF NOT EXISTS supplier (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            company TEXT NOT NULL,
            phone TEXT NOT NULL,
            email TEXT NOT NULL,
            address TEXT NOT NULL
          )
        `);
        
        sqliteDb.run(`
          CREATE TABLE IF NOT EXISTS product (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            category TEXT NOT NULL,
            supplier TEXT NOT NULL,
            price REAL NOT NULL,
            gst REAL NOT NULL DEFAULT 0,
            quantity INTEGER NOT NULL,
            minimum INTEGER NOT NULL,
            maximum INTEGER NOT NULL,
            avg_daily_sales REAL NOT NULL
          )
        `);

        sqliteDb.run(`
          CREATE TABLE IF NOT EXISTS sales (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            invoice_number TEXT UNIQUE NOT NULL,
            customer_name TEXT DEFAULT '',
            customer_phone TEXT DEFAULT '',
            payment_method TEXT NOT NULL,
            subtotal REAL NOT NULL,
            discount REAL NOT NULL DEFAULT 0,
            gst REAL NOT NULL DEFAULT 0,
            grand_total REAL NOT NULL,
            cash_received REAL NOT NULL DEFAULT 0,
            balance REAL NOT NULL DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
          )
        `);

        sqliteDb.run(`
          CREATE TABLE IF NOT EXISTS sale_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sale_id INTEGER NOT NULL,
            product_id INTEGER NOT NULL,
            product_name TEXT NOT NULL,
            price REAL NOT NULL,
            quantity INTEGER NOT NULL,
            gst REAL NOT NULL DEFAULT 0,
            discount REAL NOT NULL DEFAULT 0,
            subtotal REAL NOT NULL,
            FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE
          )
        `);

        // Seed Admin credentials
        sqliteDb.run(`
          INSERT INTO admin (username, password)
          SELECT 'admin', 'admin123'
          WHERE NOT EXISTS (SELECT 1 FROM admin WHERE username = 'admin')
        `);

        // Check and Seed Categories
        sqliteDb.get('SELECT COUNT(*) as count FROM category', (err, row) => {
          if (!err && row.count === 0) {
            sqliteDb.run(`
              INSERT INTO category (name) VALUES 
              ('Dairy'), ('Grains'), ('Beverages'), ('Snacks')
            `);
          }
        });

        // Check and Seed Suppliers
        sqliteDb.get('SELECT COUNT(*) as count FROM supplier', (err, row) => {
          if (!err && row.count === 0) {
            sqliteDb.run(`
              INSERT INTO supplier (name, company, phone, email, address) VALUES 
              ('John Doe', 'Dairy Fresh Corp', '9876543210', 'john@dairyfresh.com', '123 Milk Way, Dairy City'),
              ('Jane Smith', 'Golden Grains Co', '9876543211', 'jane@goldengrains.com', '456 Wheat Fields, Grain Valley'),
              ('Bob Johnson', 'Beverage King', '9876543212', 'bob@bevking.com', '789 Soda Springs, Drink Town')
            `);
          }
        });

        // Check and Seed Products
        sqliteDb.get('SELECT COUNT(*) as count FROM product', (err, row) => {
          if (!err && row.count === 0) {
            sqliteDb.run(`
              INSERT INTO product (name, category, supplier, price, gst, quantity, minimum, maximum, avg_daily_sales) VALUES 
              ('Fresh Milk 1L', 'Dairy', 'John Doe', 60.00, 5.00, 50, 20, 100, 5.00),
              ('Organic Butter 500g', 'Dairy', 'John Doe', 250.00, 12.00, 12, 15, 50, 3.00),
              ('White Rice 5kg', 'Grains', 'Jane Smith', 350.00, 0.00, 0, 10, 80, 2.50),
              ('Cola 500ml', 'Beverages', 'Bob Johnson', 40.00, 18.00, 100, 30, 200, 12.00),
              ('Potato Chips 100g', 'Snacks', 'Jane Smith', 20.00, 18.00, 150, 25, 250, 6.00),
              ('Apple Juice 1L', 'Beverages', 'Bob Johnson', 110.00, 12.00, 5, 10, 40, 2.00)
            `);
          }
        });
        
        resolve();
      });
    });
  });
}

// Universal Query function matching MySQL parameters interface
async function query(sql, params = []) {
  // Convert placeholder syntax if needed (MySQL and SQLite both support ? placeholders in general Node interfaces)
  if (dbType === 'mysql') {
    const [rows] = await connectionPool.execute(sql, params);
    return rows;
  } else {
    return new Promise((resolve, reject) => {
      // In SQLite, write operations use run, read operations use all/get
      const isSelect = sql.trim().toUpperCase().startsWith('SELECT');
      if (isSelect) {
        sqliteDb.all(sql, params, (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      } else {
        sqliteDb.run(sql, params, function (err) {
          if (err) {
            reject(err);
          } else {
            // Return compatibility object with insertId (MySQL uses insertId, SQLite uses lastID)
            resolve({
              insertId: this.lastID,
              affectedRows: this.changes
            });
          }
        });
      }
    });
  }
}

async function runInTransaction(callback) {
  if (dbType === 'sqlite') {
    await query('BEGIN IMMEDIATE');
    try {
      const result = await callback();
      await query('COMMIT');
      return result;
    } catch (err) {
      try {
        await query('ROLLBACK');
      } catch (rollbackErr) {
        console.error('[Database] Transaction rollback failed:', rollbackErr);
      }
      throw err;
    }
  }

  await query('START TRANSACTION');
  try {
    const result = await callback();
    await query('COMMIT');
    return result;
  } catch (err) {
    try {
      await query('ROLLBACK');
    } catch (rollbackErr) {
      console.error('[Database] Transaction rollback failed:', rollbackErr);
    }
    throw err;
  }
}

module.exports = {
  initializeDatabase,
  query,
  runInTransaction,
  getDbType: () => dbType
};
