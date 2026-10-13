const db = require('../database/db');

/** Build a date filter compatible with both MySQL and SQLite. */
function getLast30DaysFilter() {
  return db.getDbType() === 'mysql'
    ? 's.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)'
    : "s.created_at >= datetime('now', '-30 days')";
}

exports.getPredictions = async (req, res) => {
  try {
    const products = await db.query('SELECT * FROM product ORDER BY name ASC');
    const dateFilter = getLast30DaysFilter();

    const predictions = await Promise.all(products.map(async (prod) => {
      const quantity = Math.max(0, Number.parseInt(prod.quantity, 10) || 0);
      const minimum = Math.max(0, Number.parseInt(prod.minimum, 10) || 0);
      const maximum = Math.max(minimum, Number.parseInt(prod.maximum, 10) || minimum * 2 || 100);

      const salesRows = await db.query(
        `SELECT COALESCE(SUM(si.quantity), 0) as sold_units
         FROM sale_items si
         INNER JOIN sales s ON s.id = si.sale_id
         WHERE si.product_id = ? AND ${dateFilter}`,
        [prod.id]
      );

      const soldUnits = Math.max(0, Number.parseInt(salesRows[0]?.sold_units, 10) || 0);
      const configuredDailySales = Math.max(0, Number.parseFloat(prod.avg_daily_sales) || 0);
      const avgDailySales = soldUnits > 0 ? soldUnits / 30 : configuredDailySales;
      const daysLeft = avgDailySales > 0 ? quantity / avgDailySales : 999;
      const reorderLevel = Math.max(minimum, Math.ceil(avgDailySales * 7));
      const suggestedQuantity = quantity <= reorderLevel ? Math.max(0, maximum - quantity) : 0;

      let priority = 'Safe';
      let recommendation = 'Stock Level Safe';
      let priorityClass = 'safe';
      let riskLevel = 'Low';

      if (quantity === 0) {
        priority = 'Out of Stock';
        recommendation = 'Immediate Restock Required';
        priorityClass = 'out';
        riskLevel = 'Critical';
      } else if (daysLeft <= 3) {
        priority = 'Critical';
        recommendation = 'Immediate Restock; critical level';
        priorityClass = 'critical';
        riskLevel = 'Critical';
      } else if (daysLeft <= 7) {
        priority = 'Low Stock';
        recommendation = 'Reorder soon; stock depleting';
        priorityClass = 'low';
        riskLevel = 'High';
      } else if (daysLeft <= 15) {
        priority = 'Monitor';
        recommendation = 'Monitor stock; regular replenishment';
        priorityClass = 'monitor';
        riskLevel = 'Medium';
      }

      return {
        id: prod.id,
        name: prod.name,
        quantity,
        avg_daily_sales: Number(avgDailySales.toFixed(2)),
        days_left: daysLeft === 999 ? 'N/A' : Number(daysLeft.toFixed(2)),
        suggested_quantity: suggestedQuantity,
        reorder_level: reorderLevel,
        risk_level: riskLevel,
        data_source: soldUnits > 0 ? 'Last 30 days of sales' : 'Configured average sales',
        explanation: daysLeft === 999
          ? 'No recent sales velocity is available; the configured average is used.'
          : `At the current sales velocity, stock is expected to last about ${Number(daysLeft.toFixed(1))} days.`,
        priority,
        recommendation,
        priorityClass
      };
    }));

    res.json(predictions);
  } catch (err) {
    console.error('Error calculating restocking predictions:', err);
    res.status(500).json({ message: 'Error calculating predictions' });
  }
};
