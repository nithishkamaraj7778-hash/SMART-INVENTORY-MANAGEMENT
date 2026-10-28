# API Reference

This project exposes the same REST API through both `/api` and the root path for backward compatibility. The actual Express app boots from `server.js` and the route map lives in `routes/api.js`.

## Authentication

Most endpoints require a bearer token in the `Authorization` header:

```http
Authorization: Bearer <token>
```

The token is issued by `/login` and stored in the `auth_sessions` table with an 8-hour expiry window.

## Base URLs

- `http://localhost:5001/api`
- `http://localhost:5001`

## Endpoints

### POST /login

Purpose: Authenticate an admin user.

Request body:

```json
{
  "username": "admin",
  "password": "admin123"
}
```

Success response `200`:

```json
{
  "success": true,
  "message": "Authentication successful",
  "token": "<session-token>",
  "user": {
    "id": 1,
    "username": "admin"
  }
}
```

Validation:
- `username` and `password` are required.
- `password` is verified with the stored scrypt hash.

Errors:
- `400` if required fields are missing.
- `401` for invalid credentials.
- `500` for server-side failures.

### POST /register

Purpose: Create a new admin account.

Request body:

```json
{
  "username": "cashier1",
  "password": "admin123"
}
```

Rules:
- username must be at least 3 characters.
- password must be at least 8 characters.
- username must be unique.

Success response `201`:

```json
{
  "success": true,
  "message": "Account created successfully"
}
```

### GET /auth/me

Authentication: required.

Success response `200`:

```json
{
  "success": true,
  "user": {
    "id": 1,
    "username": "admin"
  }
}
```

### POST /auth/logout

Authentication: required.

Success response `200`:

```json
{
  "success": true,
  "message": "Signed out successfully."
}
```

### GET /dashboard

Authentication: required.

Purpose: Return the full dashboard payload for the front-end dashboard view.

Success response `200`:

```json
{
  "summary": {
    "totalProducts": 6,
    "totalCategories": 4,
    "totalSuppliers": 3,
    "lowStockCount": 2
  },
  "salesStats": {
    "todaySalesCount": 12,
    "todayRevenue": "1450.50",
    "productsSoldToday": 18
  },
  "recentProducts": [],
  "lowStockAlerts": [],
  "latestBills": [],
  "charts": {
    "productStocks": [],
    "categoryDistribution": []
  },
  "notifications": []
}
```

### GET /dashboard/stats

Authentication: required.

This is the primary dashboard stats endpoint; it returns the same payload as `/dashboard`.

### GET /categories

Authentication: required.

Success response `200`:

```json
[
  { "id": 1, "name": "Dairy" }
]
```

### POST /categories

Authentication: required.

Request body:

```json
{ "name": "Bakery" }
```

Success response `201`:

```json
{ "id": 10, "name": "Bakery" }
```

Validation: name is required and must be unique.

### PUT /categories/:id

Authentication: required.

Request body:

```json
{ "name": "Bakery" }
```

Success response `200`:

```json
{ "id": 10, "name": "Bakery" }
```

### DELETE /categories/:id

Authentication: required.

Success response `200`:

```json
{ "success": true, "message": "Category deleted successfully" }
```

### GET /products

Authentication: required.

Success response `200`:

```json
[
  {
    "id": 1,
    "name": "Fresh Milk 1L",
    "category": "Dairy",
    "supplier": "John Doe",
    "price": 60,
    "gst": 5,
    "quantity": 50,
    "minimum": 20,
    "maximum": 100,
    "avg_daily_sales": 5
  }
]
```

### POST /products

Authentication: required.

Request body:

```json
{
  "name": "Fresh Milk 1L",
  "category": "Dairy",
  "supplier": "John Doe",
  "price": 60,
  "gst": 5,
  "quantity": 50,
  "minimum": 20,
  "maximum": 100,
  "avg_daily_sales": 5
}
```

Validation rules:
- `name`, `category`, `supplier` are required.
- `price`, `gst`, `avg_daily_sales` must be valid non-negative numbers.
- `quantity`, `minimum`, and `maximum` must be whole numbers greater than or equal to zero.
- `maximum` cannot be less than `minimum`.

Success response `201`:

```json
{
  "id": 1,
  "name": "Fresh Milk 1L",
  "category": "Dairy",
  "supplier": "John Doe",
  "price": 60,
  "gst": 5,
  "quantity": 50,
  "minimum": 20,
  "maximum": 100,
  "avg_daily_sales": 5
}
```

### PUT /products/:id

Authentication: required.

Same request and response shape as `POST /products`.

### DELETE /products/:id

Authentication: required.

Success response `200`:

```json
{ "success": true, "message": "Product deleted successfully" }
```

### GET /suppliers

Authentication: required.

Success response `200`:

```json
[
  {
    "id": 1,
    "name": "John Doe",
    "company": "Dairy Fresh Corp",
    "phone": "9876543210",
    "email": "john@dairyfresh.com",
    "address": "123 Milk Way, Dairy City"
  }
]
```

### POST /suppliers

Authentication: required.

Request body:

```json
{
  "name": "John Doe",
  "company": "Dairy Fresh Corp",
  "phone": "9876543210",
  "email": "john@dairyfresh.com",
  "address": "123 Milk Way, Dairy City"
}
```

### PUT /suppliers/:id

Authentication: required.

Same schema as create.

### DELETE /suppliers/:id

Authentication: required.

Success response `200`:

```json
{ "success": true, "message": "Supplier deleted successfully" }
```

### GET /prediction

Authentication: required.

Purpose: Calculate stock velocity, days remaining, and reorder recommendations.

Success response `200`:

```json
[
  {
    "id": 1,
    "name": "Fresh Milk 1L",
    "quantity": 12,
    "avg_daily_sales": 1.5,
    "days_left": 8,
    "suggested_quantity": 30,
    "reorder_level": 11,
    "risk_level": "High",
    "data_source": "Last 30 days of sales",
    "explanation": "At the current sales velocity, stock is expected to last about 8.0 days.",
    "priority": "Low Stock",
    "recommendation": "Reorder soon; stock depleting",
    "priorityClass": "low"
  }
]
```

### POST /billing

Authentication: required.

Purpose: Create a sale and immediately deduct stock.

Request body:

```json
{
  "customerName": "Jane Doe",
  "customerPhone": "9876543210",
  "paymentMethod": "UPI",
  "cashReceived": 500,
  "items": [
    {
      "productId": 1,
      "quantity": 2,
      "discountPercent": 5
    },
    {
      "productId": 2,
      "quantity": 1,
      "discountPercent": 0
    }
  ]
}
```

Success response `201`:

```json
{
  "success": true,
  "message": "Payment completed successfully.",
  "sale": {
    "id": 110,
    "invoiceNumber": "INV-123456-789",
    "customerName": "Jane Doe",
    "customerPhone": "9876543210",
    "paymentMethod": "UPI",
    "subtotal": 360,
    "discount": 18,
    "gst": 46.8,
    "grandTotal": 388.8,
    "cashReceived": 500,
    "balance": 111.2,
    "items": []
  }
}
```

Validation rules:
- `items` must be a non-empty array.
- each item requires `productId`, `quantity`, and optional `discountPercent`.
- `quantity` must be a positive integer.
- `discountPercent` must be between `0` and `100`.
- payment method must be one of `Cash`, `Card`, `UPI`, or `Credit`.

Errors:
- `400` for malformed payloads.
- `404` if a product does not exist.
- `409` when the requested quantity exceeds stock.
- `500` for database or transactional failures.

### GET /sales

Authentication: required.

Purpose: Fetch sales history.

### GET /sales/:id

Authentication: required.

Purpose: Fetch a single sale record.

### GET /sales/:id/items

Authentication: required.

Purpose: Return the line items for a sale.

### POST /sales/:id/pdf

Authentication: required.

Purpose: Generate a PDF invoice for a sale.

### DELETE /sales/:id

Authentication: required.

Purpose: Remove a sale and restore inventory.

Success response `200`:

```json
{ "success": true, "message": "Invoice deleted and inventory restored." }
```

## Error Handling Notes

The API consistently returns JSON errors with a `success: false` shape for validation failures and `message` strings for user-facing details. Internal errors are logged to the console without exposing DB credentials or stack traces in the response payload.
