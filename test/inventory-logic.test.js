const test = require('node:test');
const assert = require('node:assert/strict');

const {
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
} = require('../lib/inventoryLogic');

test('validateProductPayload accepts valid stock data and normalizes values', () => {
  const result = validateProductPayload({
    name: '  Fresh Milk 1L  ',
    category: 'Dairy',
    supplier: 'John Doe',
    price: '60',
    quantity: 25,
    minimum: 10,
    maximum: 100,
    avg_daily_sales: '2.5',
    gst: '5'
  });

  assert.equal(result.valid, true);
  assert.deepEqual(result.normalized, {
    name: 'Fresh Milk 1L',
    category: 'Dairy',
    supplier: 'John Doe',
    price: 60,
    quantity: 25,
    minimum: 10,
    maximum: 100,
    avg_daily_sales: 2.5,
    gst: 5
  });
});

test('validateProductPayload rejects invalid stock quantities', () => {
  const rejectedZero = validateProductPayload({
    name: 'Milk',
    category: 'Dairy',
    supplier: 'John',
    price: '10',
    quantity: -1,
    minimum: 5,
    maximum: 50,
    avg_daily_sales: 1,
    gst: 0
  });

  const rejectedRange = validateProductPayload({
    name: 'Milk',
    category: 'Dairy',
    supplier: 'John',
    price: '10',
    quantity: 10,
    minimum: 20,
    maximum: 15,
    avg_daily_sales: 1,
    gst: 0
  });

  assert.equal(rejectedZero.valid, false);
  assert.match(rejectedZero.message, /Quantity/);
  assert.equal(rejectedRange.valid, false);
  assert.match(rejectedRange.message, /Maximum stock/);
});

test('calculateLineTotals returns correct subtotal, discount, GST and grand total', () => {
  const totals = calculateLineTotals({
    unitPrice: 100,
    quantity: 2,
    discountPercent: 10,
    gstPercent: 18
  });

  assert.equal(totals.subtotal, 200);
  assert.equal(totals.discountValue, 20);
  assert.equal(totals.discountedSubtotal, 180);
  assert.equal(totals.gstValue, 32.4);
  assert.equal(totals.total, 212.4);
});

test('validateSaleRequest rejects malformed sales payloads', () => {
  const invalidProduct = validateSaleRequest({
    items: [{ productId: 'abc', quantity: 1 }],
    paymentMethod: 'Cash'
  });

  const invalidDiscount = validateSaleRequest({
    items: [{ productId: 1, quantity: 2, discountPercent: 101 }],
    paymentMethod: 'Cash'
  });

  const validRequest = validateSaleRequest({
    items: [{ productId: 1, quantity: 2, discountPercent: 5 }],
    customerName: 'Jane',
    customerPhone: '9876543210',
    paymentMethod: 'UPI',
    cashReceived: 500
  });

  assert.equal(invalidProduct.valid, false);
  assert.match(invalidProduct.message, /valid product/);
  assert.equal(invalidDiscount.valid, false);
  assert.match(invalidDiscount.message, /between 0 and 100/);
  assert.equal(validRequest.valid, true);
  assert.equal(validRequest.normalized.items[0].quantity, 2);
});

test('restocking calculations handle missing sales data and stock warnings', () => {
  assert.equal(getAverageDailySales(0, 2.5, 30), 2.5);
  assert.equal(calculateDaysRemaining(10, 2), 5);
  assert.equal(calculateDaysRemaining(10, 0), null);

  const critical = evaluateRestockPriority({
    quantity: 3,
    minimum: 8,
    maximum: 30,
    recentSalesUnits: 0,
    configuredAverageDailySales: 2,
    salesWindowDays: 30
  });

  const safe = evaluateRestockPriority({
    quantity: 40,
    minimum: 8,
    maximum: 30,
    recentSalesUnits: 0,
    configuredAverageDailySales: 2,
    salesWindowDays: 30
  });

  assert.equal(critical.priority, 'Critical');
  assert.equal(critical.recommendation, 'Immediate Restock; critical level');
  assert.equal(safe.priority, 'Safe');
  assert.equal(safe.suggestedQuantity, 0);
});

test('demand windows and replenishment planning expose multi-window forecasts', () => {
  const windows = calculateDemandWindows({ recentSalesUnits: 60, configuredAverageDailySales: 2 });
  assert.equal(windows[0].windowDays, 7);
  assert.equal(windows[0].avgDailySales, 8.57);
  assert.equal(calculateSafetyStock({ averageDailySales: 3, leadTimeDays: 5, serviceLevelFactor: 1.5 }), 23);
  assert.equal(calculateReorderPoint({ averageDailySales: 3, leadTimeDays: 5, safetyStock: 10 }), 25);
  assert.equal(calculateRecommendedRestock({ quantity: 8, reorderPoint: 20, maxStock: 50, minimumStock: 5 }), 42);
  assert.equal(classifyDemandVelocity(6), 'Fast-moving');
});
