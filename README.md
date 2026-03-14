# HAH Inventory — Inventory Management System

A full-stack, web-based Inventory Management System (IMS) built for a Hackathon. Manage products, warehouses, stock operations, and user access — all from a sleek dark-mode dashboard.

---

## ✨ Features

| Module | Description |
|--------|-------------|
| 🔐 **Authentication** | JWT-based login, registration, OTP forgot-password, and secure password update |
| 📦 **Products** | Full CRUD with SKU, category, unit of measure, and stock thresholds |
| 🗂 **Categories** | Organize products into categories |
| 🏭 **Warehouses** | Manage multiple warehouse locations with stock tracking |
| 🔔 **Alerts** | Low-stock alerts with configurable global threshold |
| 📥 **Receipts** | Log incoming goods from suppliers; validate to update stock |
| 🚚 **Deliveries** | Log outgoing goods to customers; validate to deduct stock |
| 🔄 **Transfers** | Move stock between warehouses with duplicate-warehouse protection |
| ⚖️ **Adjustments** | Direct stock quantity corrections with reason tracking |
| 📜 **Move History (Ledger)** | Immutable, append-only log of all stock movements — filterable by operation, date |
| 📊 **Dashboard** | Live KPIs: total products, stock levels, recent activity |
| ⚙️ **Settings** | Warehouses, General preferences, User management, Security (password change) |

---

## 🏗️ Tech Stack

- **Frontend:** Vanilla JS (ES Modules), Vite, CSS Variables (dark theme)
- **Backend:** Node.js, Express.js
- **Database:** SQLite via `sql.js` (file-based, no install needed)
- **Auth:** `bcryptjs` + `jsonwebtoken`
- **Email:** `nodemailer` (Gmail SMTP for OTP delivery)

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm

### 1. Clone and Install

```bash
git clone https://github.com/heneel69/Hackathon.git
cd Hackathon
npm install
```

### 2. Configure Environment (for Gmail OTP)

Copy `.env.example` to `.env` and fill in your Gmail App Password:

```bash
cp .env.example .env
```

Edit `.env`:
```env
GMAIL_USER=your-gmail@gmail.com
GMAIL_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx
```

> **How to get a Gmail App Password:**
> 1. Enable [2-Step Verification](https://myaccount.google.com/security)
> 2. Go to [App Passwords](https://myaccount.google.com/apppasswords)
> 3. Generate one for "HAH Inventory"

> **Note:** If `.env` is not configured, the app still works — OTPs are logged to the server terminal.

### 3. Run the App

```bash
npm run dev
```

- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:3001

---

## 🔐 Default Login

On first run, register an account at the login screen. Choose the **Inventory Manager** role for full admin access.

---

## 🧪 Running Tests

```bash
npm run test
```

Tests cover:
- Ledger schema constraints (append-only triggers)
- Ledger integration (receipts, deliveries, transfers, adjustments all write correct ledger entries)
- All 37 tests pass ✅

---

## 📁 Project Structure

```
Hackathon/
├── index.html              # Main SPA shell + auth overlay
├── src/
│   ├── main.js             # SPA router
│   ├── style.css           # Global dark theme
│   └── pages/              # Page components (Vanilla JS)
│       ├── auth.js         # Login / Register / Forgot+OTP+Reset flow
│       ├── dashboard.js
│       ├── products.js
│       ├── receipts.js
│       ├── deliveries.js
│       ├── transfers.js
│       ├── adjustments.js
│       ├── MoveHistory.js
│       └── settings.js     # Warehouses / General / Users / Security tabs
├── server/
│   ├── index.js            # Express app entry point
│   ├── auth.js             # Auth routes (login, register, forgot, reset, update)
│   ├── db.js               # SQLite init, schema, helper functions
│   ├── mailer.js           # Nodemailer Gmail SMTP utility
│   ├── middleware.js        # JWT protect middleware
│   ├── otp-store.js        # In-memory OTP store with TTL
│   ├── routes/             # API route handlers
│   │   ├── products.js
│   │   ├── categories.js
│   │   ├── warehouses.js
│   │   ├── alerts.js
│   │   ├── receipts.js
│   │   ├── deliveries.js
│   │   ├── transfers.js
│   │   ├── adjustments.js
│   │   ├── ledger.js
│   │   ├── dashboard.js
│   │   ├── users.js
│   │   └── settings.js
│   └── tests/              # Node test runner test suites
├── .env.example            # Environment variable template
└── package.json
```

---

## 📜 API Endpoints (Summary)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Login, receive JWT |
| POST | `/api/auth/forgot-password` | Send OTP to email |
| POST | `/api/auth/verify-otp` | Verify 6-digit OTP |
| POST | `/api/auth/reset-password` | Reset password with verified OTP |
| PUT | `/api/auth/update-password` | Change password (authenticated) |
| GET | `/api/products` | List products |
| GET | `/api/warehouses` | List warehouses |
| GET | `/api/ledger` | Move history with filters |
| POST | `/api/receipts/:id/validate` | Validate receipt → add stock |
| POST | `/api/deliveries/:id/validate` | Validate delivery → deduct stock |
| POST | `/api/transfers/:id/validate` | Validate transfer → move stock |
| POST | `/api/adjustments` | Adjust stock quantity directly |

---

## 🛡️ Security Features

- Passwords hashed with **bcryptjs** (cost factor 12)
- JWTs expire after **8 hours**
- OTPs expire after **10 minutes** (one-time use)
- Reset tokens invalidated after use
- Append-only stock ledger enforced via **database triggers**
- `.env` excluded from version control via `.gitignore`

---

## 📄 License

MIT