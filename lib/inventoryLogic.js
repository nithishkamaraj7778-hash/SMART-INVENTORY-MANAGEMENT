function toFiniteNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function validateProductPayload(payload = {}) {
  const name = String(payload.name ?? '').trim();
  const category = String(payload.category ?? '').trim();
  const supplier = String(payload.supplier ?? '').trim();

  if (!name) return { valid: false, message: 'Product name is required.' };
  if (!category) return { valid: false, message: 'Category is required.' };
  if (!supplier) return { valid: false, message: 'Supplier is required.' };

  const price = toFiniteNumber(payload.price);
  if (!Number.isFinite(Number(payload.price)) || price < 0) {
    return { valid: false, message: 'Price must be a valid non-negative number.' };
  }

  const quantity = Number(payload.quantity);
  if (!Number.isInteger(quantity) || quantity < 0) {
    return { valid: false, message: 'Quantity must be a whole number greater than or equal to zero.' };
  }

  const minimum = Number(payload.minimum);
  if (!Number.isInteger(minimum) || minimum < 0) {
    return { valid: false, message: 'Minimum stock must be a whole number greater than or equal to zero.' };
  }

  const maximum = Number(payload.maximum);
  if (!Number.isInteger(maximum) || maximum < 0) {
    return { valid: false, message: 'Maximum stock must be a whole number greater than or equal to zero.' };
  }

  if (maximum < minimum) {
    return { valid: false, message: 'Maximum stock cannot be lower than minimum stock.' };
  }

  const avgDailySales = toFiniteNumber(payload.avg_daily_sales, 0);
  if (!Number.isFinite(Number(payload.avg_daily_sales)) || avgDailySales < 0) {
    return { valid: false, message: 'Average daily sales must be a valid non-negative number.' };
  }

  const gst = toFiniteNumber(payload.gst, 0);
  if (!Number.isFinite(Number(payload.gst)) || gst < 0) {
    return { valid: false, message: 'GST must be a valid non-negative number.' };
  }

  return {
    valid: true,
    normalized: {
      name,
      category,
      supplier,
      price,
      quantity,
      minimum,
      maximum,
      avg_daily_sales: avgDailySales,
      gst
    }
  };
}

function calculateLineTotals({ unitPrice, quantity, discountPercent = 0, gstPercent = 0 }) {
  const normalizedQuantity = Number.isInteger(Number(quantity)) ? Number(quantity) : 0;
  const unit = toFiniteNumber(unitPrice, 0);
  const discount = toFiniteNumber(discountPercent, 0);
  const gst = toFiniteNumber(gstPercent, 0);

  const subtotal = unit * normalizedQuantity;
  const discountValue = subtotal * (discount / 100);
  const discountedSubtotal = subtotal - discountValue;
  const gstValue = discountedSubtotal * (gst / 100);
  const total = discountedSubtotal + gstValue;

  return {
    subtotal,
    discountValue,
    discountedSubtotal,
    gstValue,
    total
  };
}

function validateSaleRequest(payload = {}) {
  const items = Array.isArray(payload.items) ? payload.items : [];
  if (items.length === 0) {
    return { valid: false, message: 'At least one product is required.' };
  }

  const allowedPaymentMethods = new Set(['Cash', 'Card', 'UPI', 'Credit']);
  const paymentMethod = payload.paymentMethod || 'Cash';
  if (!allowedPaymentMethods.has(paymentMethod)) {
    return { valid: false, message: 'Choose a valid payment method.' };
  }

  const normalizedItems = [];

  for (const item of items) {
    const productId = Number.parseInt(item.productId, 10);
    const quantity = Number.parseInt(item.quantity, 10);
    const discountPercent = toFiniteNumber(item.discountPercent, 0);

    if (!Number.isInteger(productId) || productId <= 0) {
      return { valid: false, message: 'Each item needs a valid product.' };
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
      return { valid: false, message: 'Each item needs a valid quantity.' };
    }

    if (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 100) {
      return { valid: false, message: 'Discounts must be between 0 and 100 percent.' };
    }

    normalizedItems.push({
      productId,
      quantity,
      discountPercent
    });
  }

  return {
    valid: true,
    normalized: {
      items: normalizedItems,
      customerName: String(payload.customerName ?? '').trim(),
      customerPhone: String(payload.customerPhone ?? '').trim(),
      paymentMethod,
      cashReceived: toFiniteNumber(payload.cashReceived, 0)
    }
  };
}

function getAverageDailySales(recentSalesUnits, configuredAverageDailySales = 0, salesWindowDays = 30) {
  const units = toFiniteNumber(recentSalesUnits, 0);
  const configuredAverage = toFiniteNumber(configuredAverageDailySales, 0);
  if (units > 0) {
    return units / Math.max(1, Number(salesWindowDays) || 30);
  }
  return configuredAverage;
}

function calculateDaysRemaining(quantity, averageDailySales) {
  const stock = toFiniteNumber(quantity, 0);
  const rate = toFiniteNumber(averageDailySales, 0);
  if (rate <= 0) return null;
  return stock / rate;
}

function evaluateRestockPriority({ quantity, minimum, maximum, recentSalesUnits, configuredAverageDailySales, salesWindowDays = 30 }) {
  const stock = toFiniteNumber(quantity, 0);
  const minLevel = Math.max(0, Number(minimum) || 0);
  const maxLevel = Math.max(minLevel, Number(maximum) || minLevel * 2 || 100);
  const averageDailySales = getAverageDailySales(recentSalesUnits, configuredAverageDailySales, salesWindowDays);
  const daysRemaining = calculateDaysRemaining(stock, averageDailySales);
  const reorderLevel = Math.max(minLevel, Math.ceil(averageDailySales * 7));
  const suggestedQuantity = stock <= reorderLevel ? Math.max(0, maxLevel - stock) : 0;

  if (stock === 0) {
    return {
      priority: 'Out of Stock',
      recommendation: 'Immediate Restock Required',
      priorityClass: 'out',
      riskLevel: 'Critical',
      daysRemaining: null,
      averageDailySales,
      reorderLevel,
      suggestedQuantity
    };
  }

  if (daysRemaining !== null && daysRemaining <= 3) {
    return {
      priority: 'Critical',
      recommendation: 'Immediate Restock; critical level',
      priorityClass: 'critical',
      riskLevel: 'Critical',
      daysRemaining,
      averageDailySales,
      reorderLevel,
      suggestedQuantity
    };
  }

  if (daysRemaining !== null && daysRemaining <= 7) {
    return {
      priority: 'Low Stock',
      recommendation: 'Reorder soon; stock depleting',
      priorityClass: 'low',
      riskLevel: 'High',
      daysRemaining,
      averageDailySales,
      reorderLevel,
      suggestedQuantity
    };
  }

  if (daysRemaining !== null && daysRemaining <= 15) {
    return {
      priority: 'Monitor',
      recommendation: 'Monitor stock; regular replenishment',
      priorityClass: 'monitor',
      riskLevel: 'Medium',
      daysRemaining,
      averageDailySales,
      reorderLevel,
      suggestedQuantity
    };
  }

  return {
    priority: 'Safe',
    recommendation: 'Stock Level Safe',
    priorityClass: 'safe',
    riskLevel: 'Low',
    daysRemaining,
    averageDailySales,
    reorderLevel,
    suggestedQuantity
  };
}

function calculateDemandWindows({ recentSalesUnits, configuredAverageDailySales = 0 }) {
  const recentUnits = toFiniteNumber(recentSalesUnits, 0);
  const configuredAverage = toFiniteNumber(configuredAverageDailySales, 0);
  const windows = [7, 14, 30].map((days) => {
    const avgDailySales = recentUnits > 0 ? recentUnits / days : configuredAverage;
    return {
      windowDays: days,
      totalUnits: Number((avgDailySales * days).toFixed(2)),
      avgDailySales: Number(avgDailySales.toFixed(2)),
      demandClassification: avgDailySales >= 2 ? 'Fast-moving' : avgDailySales >= 0.5 ? 'Moderate' : 'Slow-moving'
    };
  });

  return windows;
}

function calculateSafetyStock({ averageDailySales, leadTimeDays = 7, serviceLevelFactor = 1.5 }) {
  const avgRate = toFiniteNumber(averageDailySales, 0);
  const leadDays = Math.max(0, Number(leadTimeDays) || 0);
  const serviceFactor = Math.max(1, Number(serviceLevelFactor) || 1);
  return Math.ceil(avgRate * leadDays * serviceFactor);
}

function calculateReorderPoint({ averageDailySales, leadTimeDays = 7, safetyStock = 0 }) {
  const avgRate = toFiniteNumber(averageDailySales, 0);
  const leadDays = Math.max(0, Number(leadTimeDays) || 0);
  const stockSafety = toFiniteNumber(safetyStock, 0);
  return Math.ceil(avgRate * leadDays + stockSafety);
}

function calculateRecommendedRestock({ quantity, reorderPoint, maxStock, minimumStock = 0 }) {
  const stock = toFiniteNumber(quantity, 0);
  const reorder = Math.max(0, Number(reorderPoint) || 0);
  const max = Math.max(reorder, Number(maxStock) || reorder, Number(minimumStock) || 0);
  if (stock < reorder) {
    return Math.max(0, max - stock);
  }
  return 0;
}

function classifyDemandVelocity(averageDailySales) {
  const avgRate = toFiniteNumber(averageDailySales, 0);
  if (avgRate >= 5) return 'Fast-moving';
  if (avgRate >= 1.5) return 'Moderate';
  if (avgRate > 0) return 'Slow-moving';
  return 'No demand';
}

module.exports = {
  validateProductPayload,
  calculateLineTotals,
  validateSaleRequest,
  getAverageDailySales,
  calculateDaysRemaining,
  evaluateRestockPriority,
  calculateDemandWindows,
  calculateSafetyStock,
  calculateReorderPoint,
  calculateRecommendedRestock,
  classifyDemandVelocity
};
