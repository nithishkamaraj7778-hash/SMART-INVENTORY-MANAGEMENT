require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./database/db');
const apiRoutes = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 5001;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static assets from public/ folder
app.use(express.static(path.join(__dirname, 'public')));

// Mount API routes under both '/' and '/api' for complete endpoint compatibility
app.use('/', apiRoutes);
app.use('/api', apiRoutes);

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
    await db.initializeDatabase();
    app.listen(PORT, () => {
      console.log(`==================================================`);
      console.log(`  Smart Inventory Predictive Server is active!    `);
      console.log(`  Port: ${PORT}                                    `);
      console.log(`  URL:  http://localhost:${PORT}                   `);
      console.log(`  Database Mode: [${db.getDbType().toUpperCase()}] `);
      console.log(`==================================================`);
    });
  } catch (err) {
    console.error('Fatal error during application startup:', err);
    process.exit(1);
  }
}

startServer();
