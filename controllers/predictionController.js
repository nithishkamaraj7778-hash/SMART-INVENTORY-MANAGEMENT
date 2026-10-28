const db = require('../database/db');
const {
  evaluateRestockPriority,
  getAverageDailySales,
  calculateDemandWindows,
  calculateSafetyStock,
  calculateReorderPoint,
  calculateRecommendedRestock,
  classifyDemandVelocity
} = require('../lib/inventoryLogic');

/** Build a date filter compatible with both MySQL and SQLite. */
function getLast30DaysFilter() {
  if (db.getDbType() === 'mysql') return 's.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)';
  if (db.getDbType() === 'postgres') return "s.created_at >= NOW() - INTERVAL '30 days'";
  return "s.created_at >= datetime('now', '-30 days')";
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
      const configuredAverageDailySales = Math.max(0, Number.parseFloat(prod.avg_daily_sales) || 0);
      const avgDailySales = getAverageDailySales(soldUnits, configuredAverageDailySales, 30);
      const daysLeft = avgDailySales > 0 ? quantity / avgDailySales : null;
      const demandWindows = calculateDemandWindows({
        recentSalesUnits: soldUnits,
        configuredAverageDailySales
      });
      const leadTimeDays = Math.max(7, Math.ceil((minimum || 1) / Math.max(1, avgDailySales || 1)) || 7);
      const safetyStock = calculateSafetyStock({ averageDailySales: avgDailySales, leadTimeDays, serviceLevelFactor: 1.5 });
      const reorderPoint = calculateReorderPoint({ averageDailySales: avgDailySales, leadTimeDays, safetyStock });
      const recommendedRestock = calculateRecommendedRestock({ quantity, reorderPoint, maxStock: maximum, minimumStock: minimum });
      const stockAssessment = evaluateRestockPriority({
        quantity,
        minimum,
        maximum,
        recentSalesUnits: soldUnits,
        configuredAverageDailySales,
        salesWindowDays: 30
      });

      return {
        id: prod.id,
        name: prod.name,
        quantity,
        avg_daily_sales: Number(avgDailySales.toFixed(2)),
        days_left: daysLeft === null ? 'N/A' : Number(daysLeft.toFixed(2)),
        suggested_quantity: stockAssessment.suggestedQuantity,
        reorder_level: stockAssessment.reorderLevel,
        risk_level: stockAssessment.riskLevel,
        data_source: soldUnits > 0 ? 'Last 30 days of sales' : 'Configured average sales',
        explanation: daysLeft === null
          ? 'No recent sales velocity is available; the configured average is used.'
          : `At the current sales velocity, stock is expected to last about ${Number(daysLeft.toFixed(1))} days.`,
        priority: stockAssessment.priority,
        recommendation: stockAssessment.recommendation,
        priorityClass: stockAssessment.priorityClass,
        demand_windows: demandWindows,
        safety_stock: safetyStock,
        reorder_point: reorderPoint,
        recommended_restock_quantity: recommendedRestock,
        demand_classification: classifyDemandVelocity(avgDailySales),
        lead_time_days: leadTimeDays
      };
    }));

    res.json(predictions);
  } catch (err) {
    console.error('Error calculating restocking predictions:', err);
    res.status(500).json({ message: 'Error calculating predictions' });
  }
};
