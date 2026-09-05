# Restock Management

A full-stack **inventory management and billing (POS)** system with **predictive restocking**. Track products, suppliers, and categories; process sales with GST; and get data-driven reorder recommendations before stock runs out.

![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-4.x-000000?logo=express&logoColor=white)
![License](https://img.shields.io/badge/License-ISC-blue)

## Features

| Module | Description |
|--------|-------------|
| **Dashboard** | Real-time metrics, Chart.js analytics, low-stock alerts, today's sales |
| **Inventory** | Live stock levels with status badges and auto-refresh |
| **Predictive Restocking** | Sales-velocity analysis with priority-based reorder suggestions |
| **Billing / POS** | Cart checkout, GST, discounts, automatic stock deduction |
| **Sales History** | Invoice view, browser print, PDF download |
| **Master Data** | Categories, products (with GST), and suppliers |

## Tech Stack

- **Backend:** Node.js, Express, MySQL2 (primary) / SQLite (fallback)
- **Frontend:** Vanilla HTML, CSS, JavaScript
- **Charts:** Chart.js
- **PDF:** PDFKit

## Project Structure

```
.
├── server.js                 # Express entry point
├── controllers/              # Route handlers
├── routes/                   # API route definitions
├── database/
│   └── db.js                 # DB connection, schema, and seed data
├── public/                   # Static frontend (HTML, CSS, JS)
├── README.md
└── .gitignore
```

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18 or later
- (Optional) [MySQL](https://www.mysql.com/) 8.x for production use

### Installation

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/restock-management.git
cd restock-management

# Install dependencies
npm install

# Configure environment (optional)
cp .env.example .env

# Start the server
npm start
```

Open **http://localhost:5001** in your browser.

### Default Login

| Field | Value |
|-------|-------|
| Username | `admin` |
| Password | `admin123` |

> Change the default credentials after first login in a production deployment.

## Database

The app tries **MySQL** first using the credentials in `.env`. If MySQL is unavailable, it automatically falls back to **SQLite** (`database/inventory.db`).

Schema creation and sample seed data run automatically on startup — no manual SQL scripts required.

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `5001` | HTTP server port |
| `DB_HOST` | `localhost` | MySQL host |
| `DB_USER` | `root` | MySQL username |
| `DB_PASSWORD` | *(empty)* | MySQL password |
| `DB_NAME` | `inventory_db` | MySQL database name |

## API Overview

All endpoints are available under both `/` and `/api/` prefixes.

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/login`, `/register` | Authentication |
| GET | `/dashboard/stats` | Dashboard metrics and charts |
| GET/POST/PUT/DELETE | `/categories` | Category CRUD |
| GET/POST/PUT/DELETE | `/products` | Product CRUD |
| GET/POST/PUT/DELETE | `/suppliers` | Supplier CRUD |
| GET | `/prediction` | Restock predictions |
| POST | `/billing` | Create a sale |
| GET/DELETE | `/sales/:id` | Sales history and details |
| POST | `/sales/:id/pdf` | Download invoice PDF |

## Screenshots

> Add screenshots of the dashboard, billing, and prediction pages here before publishing.

## Development

```bash
npm start    # Runs on http://localhost:5001
```

## Railway Deployment

1. Create a Railway project and deploy this repository as a service.
2. Add a Railway MySQL service to the project and connect it to the app service.
3. Railway provides `MYSQLHOST`, `MYSQLPORT`, `MYSQLUSER`, `MYSQLPASSWORD`, and `MYSQLDATABASE`; the app reads these automatically.
4. Deploy with the default start command, `npm start`.

Railway supplies the public `PORT` automatically. The app listens on `0.0.0.0` and exposes `/health` for health checks. SQLite remains available only as a local fallback; use Railway MySQL for persistent production data.

## Roadmap / Ideas to Stand Out

- [ ] Password hashing (bcrypt) and JWT-based sessions
- [ ] Role-based access (admin vs cashier)
- [ ] Docker Compose setup (Node + MySQL)
- [ ] Automated tests (Jest + Supertest)
- [ ] CI/CD with GitHub Actions
- [ ] Dark/light theme toggle
- [ ] Export reports to CSV/Excel
- [ ] Email alerts for critical stock levels
- [ ] Demo GIF in README

## License

ISC

## Author

Built as a smart inventory and restocking management system.
