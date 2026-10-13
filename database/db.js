const mysql = require('mysql2/promise');
const { Pool } = require('pg');
const sqlite3 = require('sqlite3').verbose();
const { AsyncLocalStorage } = require('async_hooks');
const path = require('path');
const fs = require('fs');

let connectionPool = null;
let postgresPool = null;
let sqliteDb = null;
let dbType = 'sqlite'; // Default fallback
const transactionConnection = new AsyncLocalStorage();

// Optional MySQL configuration for local development.
const DB_HOST = process.env.DB_HOST || process.env.MYSQLHOST || 'localhost';
const DB_USER = process.env.DB_USER || process.env.MYSQLUSER || 'root';
const DB_PASSWORD = process.env.DB_PASSWORD || process.env.MYSQLPASSWORD || '';
const DB_NAME = process.env.DB_NAME || process.env.MYSQLDATABASE || 'inventory_db';
const DB_PORT = Number(process.env.DB_PORT || process.env.MYSQLPORT) || 3306;

async function initializeDatabase() {
  const postgresUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL;
  if (postgresUrl) {
    console.log('[Database] Attempting to connect to PostgreSQL...');
    const connectionUrl = new URL(postgresUrl);
    if (['require', 'verify-ca'].includes(connectionUrl.searchParams.get('sslmode'))) {
      connectionUrl.searchParams.set('sslmode', 'verify-full');
    }
    postgresPool = new Pool({
      connectionString: connectionUrl.toString(),
      max: Number(process.env.DB_POOL_MAX) || 1,
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 10000
    });

    try {
      const connection = await postgresPool.connect();
      connection.release();
      dbType = 'postgres';
      await setupPostgresSchema();
      await ensureProductGstColumn();
      await query('DELETE FROM auth_sessions WHERE expires_at <= ?', [Date.now()]);
      console.log('[Database] PostgreSQL connected successfully!');
      return;
    } catch (err) {
      await postgresPool.end();
      postgresPool = null;
      throw new Error(`PostgreSQL initialization failed: ${err.code || err.message || err.name}`);
    }
  }

  if (process.env.VERCEL && process.env.ALLOW_SQLITE_FALLBACK !== 'true') {
    throw new Error('PostgreSQL DATABASE_URL is required in production.');
  }

  try {
    console.log('[Database] Attempting to connect to MySQL...');
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
    } else if (dbType === 'postgres') {
      await query('ALTER TABLE product ADD COLUMN IF NOT EXISTS gst DECIMAL(5,2) NOT NULL DEFAULT 0');
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

async function setupPostgresSchema() {
  const statements = [
    `CREATE TABLE IF NOT EXISTS admin (
      id SERIAL PRIMARY KEY,
      username VARCHAR(50) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS auth_sessions (
      token_hash CHAR(64) PRIMARY KEY,
      user_id INTEGER NOT NULL,
      username VARCHAR(50) NOT NULL,
      expires_at BIGINT NOT NULL
    )`,
    'CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires_at ON auth_sessions (expires_at)',
    `CREATE TABLE IF NOT EXISTS category (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) UNIQUE NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS supplier (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      company VARCHAR(100) NOT NULL,
      phone VARCHAR(50) NOT NULL,
      email VARCHAR(100) NOT NULL,
      address TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS product (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      category VARCHAR(100) NOT NULL,
      supplier VARCHAR(100) NOT NULL,
      price DECIMAL(10,2) NOT NULL,
      gst DECIMAL(5,2) NOT NULL DEFAULT 0,
      quantity INTEGER NOT NULL,
      minimum INTEGER NOT NULL,
      maximum INTEGER NOT NULL,
      avg_daily_sales DECIMAL(10,2) NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS sales (
      id SERIAL PRIMARY KEY,
      invoice_number VARCHAR(50) UNIQUE NOT NULL,
      customer_name VARCHAR(100) DEFAULT '',
      customer_phone VARCHAR(50) DEFAULT '',
      payment_method VARCHAR(20) NOT NULL,
      subtotal DECIMAL(10,2) NOT NULL,
      discount DECIMAL(10,2) NOT NULL DEFAULT 0,
      gst DECIMAL(10,2) NOT NULL DEFAULT 0,
      grand_total DECIMAL(10,2) NOT NULL,
      cash_received DECIMAL(10,2) NOT NULL DEFAULT 0,
      balance DECIMAL(10,2) NOT NULL DEFAULT 0,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS sale_items (
      id SERIAL PRIMARY KEY,
      sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL,
      product_name VARCHAR(100) NOT NULL,
      price DECIMAL(10,2) NOT NULL,
      quantity INTEGER NOT NULL,
      gst DECIMAL(10,2) NOT NULL DEFAULT 0,
      discount DECIMAL(10,2) NOT NULL DEFAULT 0,
      subtotal DECIMAL(10,2) NOT NULL
    )`
  ];

  await runInTransaction(async () => {
    await query('SELECT pg_advisory_xact_lock(284716205)');

    for (const statement of statements) {
      await query(statement);
    }

    await query(
      `INSERT INTO admin (username, password) VALUES ('admin', 'admin123')
       ON CONFLICT (username) DO NOTHING`
    );

    const [categories] = await query('SELECT COUNT(*) AS count FROM category');
    if (Number(categories.count) === 0) {
      await query("INSERT INTO category (name) VALUES ('Dairy'), ('Grains'), ('Beverages'), ('Snacks') ON CONFLICT (name) DO NOTHING");
    }

    const [suppliers] = await query('SELECT COUNT(*) AS count FROM supplier');
    if (Number(suppliers.count) === 0) {
      await query(
        `INSERT INTO supplier (name, company, phone, email, address) VALUES
         ('John Doe', 'Dairy Fresh Corp', '9876543210', 'john@dairyfresh.com', '123 Milk Way, Dairy City'),
         ('Jane Smith', 'Golden Grains Co', '9876543211', 'jane@goldengrains.com', '456 Wheat Fields, Grain Valley'),
         ('Bob Johnson', 'Beverage King', '9876543212', 'bob@bevking.com', '789 Soda Springs, Drink Town')`
      );
    }

    const [products] = await query('SELECT COUNT(*) AS count FROM product');
    if (Number(products.count) === 0) {
      await query(
        `INSERT INTO product (name, category, supplier, price, gst, quantity, minimum, maximum, avg_daily_sales) VALUES
         ('Fresh Milk 1L', 'Dairy', 'John Doe', 60.00, 5.00, 50, 20, 100, 5.00),
         ('Organic Butter 500g', 'Dairy', 'John Doe', 250.00, 12.00, 12, 15, 50, 3.00),
         ('White Rice 5kg', 'Grains', 'Jane Smith', 350.00, 0.00, 0, 10, 80, 2.50),
         ('Cola 500ml', 'Beverages', 'Bob Johnson', 40.00, 18.00, 100, 30, 200, 12.00),
         ('Potato Chips 100g', 'Snacks', 'Jane Smith', 20.00, 18.00, 150, 25, 250, 6.00),
         ('Apple Juice 1L', 'Beverages', 'Bob Johnson', 110.00, 12.00, 5, 10, 40, 2.00)`
      );
    }
  });
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

function toPostgresSql(sql) {
  let parameterIndex = 0;
  return sql
    .replace(/`/g, '"')
    .replace(/\?/g, () => `$${++parameterIndex}`);
}

// Preserve the result shape shared by the existing database drivers.
async function query(sql, params = []) {
  if (dbType === 'postgres') {
    const transactionClient = transactionConnection.getStore();
    const insertTable = sql.match(/^\s*INSERT\s+INTO\s+[`"]?([a-z_][a-z0-9_]*)/i)?.[1]?.toLowerCase();
    const insertNeedsId = ['admin', 'category', 'supplier', 'product', 'sales', 'sale_items'].includes(insertTable);
    let statement = toPostgresSql(sql).replace(/;\s*$/, '');
    if (insertNeedsId && !/\bRETURNING\b/i.test(statement)) {
      statement += ' RETURNING id';
    }

    const result = await (transactionClient || postgresPool).query(statement, params);
    if (/^\s*(SELECT|WITH)\b/i.test(sql) || /\bRETURNING\b/i.test(statement)) {
      if (insertNeedsId) {
        return {
          insertId: result.rows[0]?.id ?? null,
          affectedRows: result.rowCount
        };
      }
      return result.rows;
    }
    return { affectedRows: result.rowCount, insertId: null };
  }

  if (dbType === 'mysql') {
    const connection = transactionConnection.getStore() || connectionPool;
    const [rows] = await connection.execute(sql, params);
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

  const connection = dbType === 'postgres'
    ? await postgresPool.connect()
    : await connectionPool.getConnection();
  const begin = dbType === 'postgres' ? () => connection.query('BEGIN') : () => connection.beginTransaction();
  const commit = dbType === 'postgres' ? () => connection.query('COMMIT') : () => connection.commit();
  const rollback = dbType === 'postgres' ? () => connection.query('ROLLBACK') : () => connection.rollback();

  try {
    await begin();
    const result = await transactionConnection.run(connection, callback);
    await commit();
    return result;
  } catch (err) {
    try {
      await rollback();
    } catch (rollbackErr) {
      console.error('[Database] Transaction rollback failed:', rollbackErr);
    }
    throw err;
  } finally {
    connection.release();
  }
}

module.exports = {
  initializeDatabase,
  query,
  runInTransaction,
  getDbType: () => dbType
};
