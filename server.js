require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./database/db');
const apiRoutes = require('./routes/api');

const app = express();
const PORT = Number(process.env.PORT) || 5001;
const HOST = process.env.HOST || '0.0.0.0';
let databaseReady;

function ensureDatabaseInitialized() {
  if (!databaseReady) {
    databaseReady = db.initializeDatabase().catch((err) => {
      databaseReady = null;
      throw err;
    });
  }
  return databaseReady;
}

// Middlewares
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => {
  ensureDatabaseInitialized().then(() => next()).catch((err) => {
    console.error('Database initialization failed while handling a request:', err);
    res.status(503).json({ success: false, message: 'The application database is unavailable.' });
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', database: db.getDbType() });
});

// Serve static assets from public/ folder
app.use(express.static(path.join(__dirname, 'public')));

// Serve the public landing page before the root-level API compatibility routes.
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Mount /api first so its requests are not intercepted by the root compatibility mount.
app.use('/api', apiRoutes);
app.use('/', apiRoutes);

// Fallback to serving the HTML index for any client-side routes
app.get('*', (req, res, next) => {
  // If the request accepts html, serve login.html as the primary landing page
  if (req.accepts('html')) {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
  } else {
    next();
  }
});

// Database initialization & server bootstrap
async function startServer() {
  try {
    await ensureDatabaseInitialized();

    const publicUrl = process.env.RAILWAY_PUBLIC_DOMAIN
      ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
      : process.env.PUBLIC_URL || `http://${HOST}:${PORT}`;

    app.listen(PORT, HOST, () => {
      console.log(`==================================================`);
      console.log(`  Smart Inventory Predictive Server is active!    `);
      console.log(`  Host: ${HOST}                                    `);
      console.log(`  Port: ${PORT}                                    `);
      console.log(`  URL:  ${publicUrl}                               `);
      console.log(`  Database Mode: [${db.getDbType().toUpperCase()}] `);
      console.log(`==================================================`);
    });
  } catch (err) {
    console.error('Fatal error during application startup:', err);
    process.exit(1);
  }
}

if (process.env.VERCEL) {
  module.exports = app;
} else {
  startServer();
}
