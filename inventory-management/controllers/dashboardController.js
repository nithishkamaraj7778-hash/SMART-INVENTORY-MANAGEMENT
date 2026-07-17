const db = require('../database/db');

async function buildDashboardPayload() {
  const productsCountRes = await db.query('SELECT COUNT(*) as count FROM product');
  const categoriesCountRes = await db.query('SELECT COUNT(*) as count FROM category');
  const suppliersCountRes = await db.query('SELECT COUNT(*) as count FROM supplier');
  const lowStockCountRes = await db.query('SELECT COUNT(*) as count FROM product WHERE quantity <= minimum');

  const totalProducts = productsCountRes[0]?.count || 0;
  const totalCategories = categoriesCountRes[0]?.count || 0;
  const totalSuppliers = suppliersCountRes[0]?.count || 0;
  const lowStockCount = lowStockCountRes[0]?.count || 0;

  const recentProducts = await db.query('SELECT * FROM product ORDER BY id DESC LIMIT 5');
  const lowStockAlerts = await db.query('SELECT * FROM product WHERE quantity <= minimum ORDER BY quantity ASC LIMIT 10');
  const productStocks = await db.query('SELECT name, quantity, minimum FROM product ORDER BY name ASC');
  const categoryDistribution = await db.query('SELECT category, COUNT(*) as count FROM product GROUP BY category');

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
      lowStockCount
    },
    salesStats: {
      todaySalesCount: todaySalesRes[0]?.count || 0,
      todayRevenue: Number(todaySalesRes[0]?.revenue || 0).toFixed(2),
      productsSoldToday: todayItemsRes[0]?.sold || 0
    },
    recentProducts,
    lowStockAlerts,
    latestBills,
    charts: {
      productStocks,
      categoryDistribution
    },
    notifications
  };
}

exports.getDashboardData = async (req, res) => {
  try {
    const payload = await buildDashboardPayload();
    res.json(payload);
  } catch (err) {
    console.error('Error fetching dashboard statistics:', err);
    res.status(500).json({ message: 'Error loading dashboard telemetry data' });
  }
};

exports.getDashboardStats = async (req, res) => {
  try {
    const payload = await buildDashboardPayload();
    res.json(payload);
  } catch (err) {
    console.error('Error fetching dashboard stats:', err);
    res.status(500).json({ message: 'Error loading dashboard stats' });
  }
};
