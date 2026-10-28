const db = require('../database/db');

async function buildDashboardPayload() {
  const productsCountRes = await db.query('SELECT COUNT(*) as count FROM product');
  const categoriesCountRes = await db.query('SELECT COUNT(*) as count FROM category');
  const suppliersCountRes = await db.query('SELECT COUNT(*) as count FROM supplier');
  const lowStockCountRes = await db.query('SELECT COUNT(*) as count FROM product WHERE quantity <= minimum');
  const inventoryValueRes = await db.query('SELECT COALESCE(SUM(price * quantity), 0) as value FROM product');
  const stockoutRiskRes = await db.query('SELECT COUNT(*) as count FROM product WHERE quantity <= minimum OR quantity = 0');

  const totalProducts = Number(productsCountRes[0]?.count || 0);
  const totalCategories = Number(categoriesCountRes[0]?.count || 0);
  const totalSuppliers = Number(suppliersCountRes[0]?.count || 0);
  const lowStockCount = Number(lowStockCountRes[0]?.count || 0);
  const inventoryValue = Number(inventoryValueRes[0]?.value || 0);
  const stockoutRiskCount = Number(stockoutRiskRes[0]?.count || 0);

  const recentProducts = await db.query('SELECT * FROM product ORDER BY id DESC LIMIT 5');
  const lowStockAlerts = await db.query('SELECT * FROM product WHERE quantity <= minimum ORDER BY quantity ASC LIMIT 10');
  const productStocks = await db.query('SELECT name, quantity, minimum FROM product ORDER BY name ASC');
  const categoryDistributionRows = await db.query('SELECT category, COUNT(*) as count FROM product GROUP BY category');
  const categoryDistribution = categoryDistributionRows.map((row) => ({ ...row, count: Number(row.count) }));

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const pad = (value) => String(value).padStart(2, '0');
  const todayQuery = `${todayStart.getFullYear()}-${pad(todayStart.getMonth() + 1)}-${pad(todayStart.getDate())} ${pad(todayStart.getHours())}:${pad(todayStart.getMinutes())}:${pad(todayStart.getSeconds())}`;

  const todaySalesRes = await db.query(
    'SELECT COUNT(*) as count, COALESCE(SUM(grand_total), 0) as revenue FROM sales WHERE created_at >= ?',
    [todayQuery]
  );
  const todayItemsRes = await db.query(
    'SELECT COALESCE(SUM(quantity), 0) as sold FROM sale_items INNER JOIN sales ON sales.id = sale_items.sale_id WHERE sales.created_at >= ?',
    [todayQuery]
  );
  const latestBills = await db.query(
    'SELECT id, invoice_number, grand_total, created_at, customer_name FROM sales ORDER BY id DESC LIMIT 5'
  );
  const topProductsRes = await db.query(
    `SELECT p.name, COALESCE(SUM(si.quantity), 0) as sold_units
     FROM product p
     LEFT JOIN sale_items si ON si.product_id = p.id
     GROUP BY p.id, p.name
     ORDER BY sold_units DESC, p.name ASC
     LIMIT 5`
  );
  const slowMovingRes = await db.query(
    `SELECT p.name, p.quantity, p.minimum, p.avg_daily_sales
     FROM product p
     WHERE COALESCE(p.avg_daily_sales, 0) <= 1
     ORDER BY p.avg_daily_sales ASC, p.quantity ASC
     LIMIT 5`
  );
  const salesTrendDateFilter = db.getDbType() === 'postgres'
    ? "created_at >= NOW() - INTERVAL '7 days'"
    : db.getDbType() === 'mysql'
      ? 'created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)'
      : "created_at >= datetime('now', '-7 days')";

  const salesTrendRes = await db.query(
    `SELECT DATE(created_at) as date, COALESCE(SUM(grand_total), 0) as revenue
     FROM sales
     WHERE ${salesTrendDateFilter}
     GROUP BY DATE(created_at)
     ORDER BY date ASC`
  );

  const allProducts = await db.query('SELECT name, quantity, minimum, avg_daily_sales FROM product');
  const notifications = [];

  let belowMinCount = 0;
  allProducts.forEach(prod => {
    const quantity = parseInt(prod.quantity);
    const minimum = parseInt(prod.minimum);
    const avgSales = parseFloat(prod.avg_daily_sales);

    if (quantity <= minimum) {
      belowMinCount++;
    }

    if (quantity === 0) {
      notifications.push({
        type: 'danger',
        message: `${prod.name} is out of stock! Needs immediate restocking.`
      });
    } else if (avgSales > 0) {
      const daysLeft = quantity / avgSales;
      if (daysLeft <= 3) {
        notifications.push({
          type: 'warning',
          message: `${prod.name} will run out in ${daysLeft.toFixed(1)} days.`
        });
      }
    }
  });

  if (belowMinCount > 0) {
    notifications.unshift({
      type: 'info',
      message: `${belowMinCount} product${belowMinCount > 1 ? 's are' : ' is'} below minimum stock.`
    });
  }

  return {
    summary: {
      totalProducts,
      totalCategories,
      totalSuppliers,
      lowStockCount,
      inventoryValue,
      stockoutRiskCount
    },
    salesStats: {
      todaySalesCount: Number(todaySalesRes[0]?.count || 0),
      todayRevenue: Number(todaySalesRes[0]?.revenue || 0).toFixed(2),
      productsSoldToday: Number(todayItemsRes[0]?.sold || 0)
    },
    recentProducts,
    lowStockAlerts,
    latestBills,
    charts: {
      productStocks,
      categoryDistribution,
      salesTrend: salesTrendRes.map((row) => ({ ...row, revenue: Number(row.revenue || 0) }))
    },
    analytics: {
      topSellingProducts: topProductsRes.map((row) => ({ ...row, sold_units: Number(row.sold_units || 0) })),
      slowMovingProducts: slowMovingRes.map((row) => ({ ...row, avg_daily_sales: Number(row.avg_daily_sales || 0), quantity: Number(row.quantity || 0) })),
      inventoryValue,
      stockoutRiskCount
    },
    notifications
  };
}

async function sendDashboardResponse(res) {
  try {
    const payload = await buildDashboardPayload();
    res.json(payload);
  } catch (err) {
    console.error('Error fetching dashboard data:', err);
    res.status(500).json({ message: 'Error loading dashboard data' });
  }
}

/** Legacy route alias — frontend uses /dashboard/stats */
exports.getDashboardData = (req, res) => sendDashboardResponse(res);

/** Primary dashboard endpoint used by the frontend */
exports.getDashboardStats = (req, res) => sendDashboardResponse(res);
