# Enyukado

A buy-and-sell web platform exclusively for students of National University Manila. Built with vanilla HTML/CSS/JS on the frontend and Node.js + Express + SQL Server on the backend.

---

## Features

- Student registration with data privacy consent and admin approval before access
- University email restricted to `@students.national-u.edu.ph`
- Browse, search, and filter listings by category, condition, and price
- Post listings with 1–5 images, pending admin approval before going live
- Buy items directly — no cart; payment via GCash (QR code) or E-bank (card form)
- Upload proof of payment; admin verifies before transaction proceeds
- Campus pickup system — seller drops off at designated location, buyer collects
- In-app messaging between buyer and seller
- Enyukado Bot — automated notifications sent privately to each party at every transaction step
- Seller profiles with star ratings and reviews (after completed transactions)
- Save items to a wishlist
- Admin portal at `/admin-login.html` — approve accounts, listings, and payments
- Separate admin login restricted to `@national-u.edu.ph`

---

## Prerequisites

| Tool | Link |
|------|------|
| Node.js (LTS) | https://nodejs.org |
| SQL Server Express 2022 | https://www.microsoft.com/en-us/sql-server/sql-server-downloads |
| SSMS 2022 | https://learn.microsoft.com/en-us/sql/ssms/download-sql-server-management-studio-ssms |
| VS Code | https://code.visualstudio.com |
| Live Server (VS Code extension) | Search "Live Server" by Ritwick Dey in VS Code Extensions |

---

## Project Structure

```
campus-marketplace/
├── backend/
│   ├── config/
│   │   └── db.js
│   ├── middleware/
│   │   └── auth.js
│   ├── routes/
│   │   ├── adminRoutes.js
│   │   ├── categoryRoutes.js
│   │   ├── messageRoutes.js
│   │   ├── productRoutes.js
│   │   ├── reviewRoutes.js
│   │   ├── savedRoutes.js
│   │   ├── transactionRoutes.js
│   │   └── userRoutes.js
│   ├── uploads/               ← auto-created on first run
│   │   ├── messages/
│   │   ├── payment-proofs/
│   │   ├── products/
│   │   └── qrcodes/
│   ├── .env                   ← you create this (see below)
│   ├── package.json
│   └── server.js
├── database/
│   ├── schema.sql
│   └── schema_migration.sql
├── frontend/
│   ├── admin-dashboard.html
│   ├── admin-login.html
│   ├── dashboard.html
│   ├── dashboard-api.js
│   ├── index.html
│   ├── index.css
│   ├── index.js
│   ├── privacy.html
│   ├── profile.html
│   ├── profile-api.js
│   └── terms.html
└── README.md
```

---

## Setup Guide

### 1. Clone the repository

```bash
git clone https://github.com/Snowfall-dotcom/enyukado.git
cd enyukado
```

### 2. Set up the database

1. Open **SSMS 2022** and connect to `localhost\SQLEXPRESS`
2. Click **New Query** and run:

```sql
CREATE DATABASE CampusMarketplace;
```

3. Select `CampusMarketplace` from the database dropdown
4. Open and run `database/schema.sql` — creates all tables, seeds categories
5. Open and run `database/schema_migration.sql` — adds new columns and constraints

### 3. Seed required accounts

Still in SSMS with `CampusMarketplace` selected, run:

```sql
-- Admin account (login at /admin-login.html)
INSERT INTO Users (FirstName, LastName, Email, Password, IsAdmin, IsApproved)
VALUES (
    'Admin', 'Enyukado',
    'admin@national-u.edu.ph',
    '$2a$10$REPLACE_WITH_BCRYPT_HASH_OF_YOUR_PASSWORD',
    1, 1
);

-- Enyukado Bot (automated notifications — do not delete)
INSERT INTO Users (FirstName, LastName, Email, Password, IsAdmin, IsApproved)
VALUES (
    'Enyukado', 'Bot',
    'bot@enyukado.system',
    'NOT_A_REAL_PASSWORD',
    0, 1
);
```

> To generate a bcrypt hash for the admin password, run this in the backend folder:
> ```bash
> node -e "const b = require('bcryptjs'); b.hash('yourpassword', 10).then(h => console.log(h));"
> ```

> **Important:** The Bot account must have `UserID = 4`. If it ends up with a different ID, update the `BOT_USER_ID` constant in `transactionRoutes.js`, `adminRoutes.js`, and `messageRoutes.js`.

### 4. Install backend dependencies

```bash
cd backend
npm install
```

### 5. Create the `.env` file

Create a file called `.env` inside the `backend/` folder:

```env
DB_USER=your_sql_server_username
DB_PASSWORD=your_sql_server_password
DB_SERVER=localhost\SQLEXPRESS
DB_NAME=CampusMarketplace
JWT_SECRET=pick_any_long_random_string_here
PORT=5000
```

> If using Windows Authentication, enable SQL Server Authentication in SSMS and create a SQL login.

### 6. Start the backend

```bash
cd backend
node server.js
```

Expected output:
```
✅ Connected to SQL Server
🚀 Server running on http://localhost:5000
```

### 7. Run the frontend

1. Open the `frontend/` folder in VS Code
2. Right-click `index.html`
3. Click **Open with Live Server**
4. Opens at `http://127.0.0.1:5500`

---

## Accounts

| Role | Login Page | Email Domain |
|------|-----------|--------------|
| Student | `index.html` | `@students.national-u.edu.ph` |
| Admin | `admin-login.html` | `@national-u.edu.ph` |

Student accounts require admin approval before they can log in.

---

## Transaction Flow

```
Buyer clicks Buy
    → Selects GCash or E-bank
    → Uploads proof of payment
    → Transaction created (Pending)

Admin approves payment
    → Transaction → Payment Approved
    → Bot notifies seller to drop off item

Seller drops off item at pickup location
    → Transaction → Dropped Off
    → Bot notifies buyer item is ready

Buyer confirms pickup
    → Transaction → Completed
    → Buyer can now leave a review
```

**Pickup Location:** Student Affairs Office, Ground Floor, Building A *(assumed)*

---

## API Endpoints

### Users
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/users/register` | — | Register (pending approval) |
| POST | `/api/users/login` | — | Student login |
| POST | `/api/users/admin-login` | — | Admin login |
| GET | `/api/users/profile` | ✅ | Get own profile |
| PUT | `/api/users/profile` | ✅ | Update profile |
| POST | `/api/users/qr` | ✅ | Upload payment QR code |
| PUT | `/api/users/change-password` | ✅ | Change password |
| GET | `/api/users/:id` | — | Get public profile |

### Products
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/products` | — | Get available listings |
| GET | `/api/products/my/listings` | ✅ | Get own listings |
| GET | `/api/products/:id` | — | Get single listing |
| POST | `/api/products/add` | ✅ | Post listing (pending approval) |
| PUT | `/api/products/:id` | ✅ | Edit listing |
| DELETE | `/api/products/:id` | ✅ | Delete listing |

### Transactions
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/transactions` | ✅ | Buy item (with payment proof) |
| GET | `/api/transactions/my/purchases` | ✅ | Get purchases |
| GET | `/api/transactions/my/sales` | ✅ | Get sales |
| GET | `/api/transactions/:id` | ✅ | Get single transaction |
| PATCH | `/api/transactions/:id/dropoff` | ✅ | Seller marks dropped off |
| PATCH | `/api/transactions/:id/complete` | ✅ | Buyer confirms pickup |

### Messages
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/messages` | ✅ | Send message (text or image) |
| GET | `/api/messages/conversations` | ✅ | Get conversation list |
| GET | `/api/messages/thread/:userID` | ✅ | Get message thread |
| GET | `/api/messages/unread` | ✅ | Get unread count |
| GET | `/api/messages/search?q=` | ✅ | Search users to message |

### Admin
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/admin/counts` | ✅ Admin | Get pending counts |
| GET | `/api/admin/accounts/pending` | ✅ Admin | Get pending accounts |
| PATCH | `/api/admin/accounts/:id/approve` | ✅ Admin | Approve account |
| PATCH | `/api/admin/accounts/:id/reject` | ✅ Admin | Reject account |
| GET | `/api/admin/listings/pending` | ✅ Admin | Get pending listings |
| PATCH | `/api/admin/listings/:id/approve` | ✅ Admin | Approve listing |
| PATCH | `/api/admin/listings/:id/reject` | ✅ Admin | Reject listing |
| GET | `/api/admin/payments/pending` | ✅ Admin | Get pending payments |
| PATCH | `/api/admin/payments/:id/approve` | ✅ Admin | Approve payment |
| PATCH | `/api/admin/payments/:id/reject` | ✅ Admin | Reject payment |

### Other
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/categories` | — | Get all categories |
| GET | `/api/saved` | ✅ | Get saved items |
| POST | `/api/saved` | ✅ | Save an item |
| DELETE | `/api/saved/:productID` | ✅ | Unsave an item |
| POST | `/api/reviews` | ✅ | Submit a review |
| GET | `/api/reviews/user/:userID` | — | Get reviews for a user |

---

## Notes

- Uploaded files (product images, QR codes, payment proofs, message images) are stored in `backend/uploads/` and are excluded from Git — each machine stores its own files
- Passwords are hashed with bcrypt, never stored in plain text
- JWT tokens expire after 1 day
- The Enyukado Bot account (`UserID 4`) is required for automated notifications — do not delete it
- Backend runs on port `5000`, frontend on port `5500` via Live Server

---

## Built With

- **Frontend** — HTML, CSS, JavaScript (vanilla)
- **Backend** — Node.js, Express.js
- **Database** — Microsoft SQL Server (`mssql`)
- **Auth** — JSON Web Tokens (`jsonwebtoken`), `bcryptjs`
- **File Uploads** — `multer`

---

*Built for National University Manila.*
