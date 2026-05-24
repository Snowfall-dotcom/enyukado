# Enyukado — Campus Marketplace

A buy-and-sell web platform exclusively for students of National University Manila. Built with vanilla HTML/CSS/JS on the frontend and Node.js + Express + SQL Server on the backend.

---

## Features

- Student account registration and login with JWT authentication
- Browse, search, and filter listings by category and condition
- Post listings with image uploads
- Add to cart and purchase items
- Save items to a persistent wishlist
- Seller profiles with ratings and reviews
- Transaction management (Pending → Completed)
- Change password and edit profile

---

## Prerequisites

Make sure these are installed before setting up:

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
│   ├── controllers/
│   │   └── productController.js
│   ├── middleware/
│   │   └── auth.js
│   ├── routes/
│   │   ├── cartRoutes.js
│   │   ├── categoryRoutes.js
│   │   ├── productRoutes.js
│   │   ├── reviewRoutes.js
│   │   ├── savedRoutes.js
│   │   ├── transactionRoutes.js
│   │   └── userRoutes.js
│   ├── uploads/          ← auto-created on first run
│   ├── .env              ← you create this (see below)
│   ├── package.json
│   └── server.js
├── database/
│   ├── schema.sql
│   └── savedItems.sql
├── frontend/
│   ├── assets/
│   ├── components/
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
git clone https://github.com/your-username/enyukado.git
cd enyukado
```

### 2. Set up the database

1. Open **SSMS 2022** and connect to `localhost\SQLEXPRESS`
2. In the top toolbar, click **New Query**
3. Run the following to create the database:
```sql
CREATE DATABASE CampusMarketplace;
```
4. Select `CampusMarketplace` from the database dropdown
5. Open and run `database/schema.sql` — this creates all tables and seeds the categories
6. Open and run `database/savedItems.sql` — this creates the SavedItems table

### 3. Install backend dependencies

```bash
cd backend
npm install
```

### 4. Create the `.env` file

Create a file called `.env` inside the `backend/` folder with the following contents:

```env
DB_USER=your_sql_server_username
DB_PASSWORD=your_sql_server_password
DB_SERVER=localhost\SQLEXPRESS
DB_NAME=CampusMarketplace
JWT_SECRET=pick_any_long_random_string_here
PORT=5000
```

> If you're using Windows Authentication for SQL Server (no username/password), you may need to enable SQL Server Authentication in SSMS and create a login.

### 5. Start the backend server

```bash
node server.js
```

You should see:
```
✅ Connected to SQL Server
🚀 Server running on http://localhost:5000
```

### 6. Run the frontend

1. Open the `frontend/` folder in VS Code
2. Right-click `index.html`
3. Click **Open with Live Server**
4. The app will open at `http://127.0.0.1:5500`

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/users/register` | Register a new account |
| POST | `/api/users/login` | Log in |
| GET | `/api/users/profile` | Get own profile |
| PUT | `/api/users/profile` | Update profile |
| PUT | `/api/users/change-password` | Change password |
| GET | `/api/products` | Get all listings |
| POST | `/api/products/add` | Post a new listing |
| PUT | `/api/products/:id` | Edit a listing |
| DELETE | `/api/products/:id` | Remove a listing |
| GET | `/api/cart` | Get cart items |
| POST | `/api/cart` | Add to cart |
| DELETE | `/api/cart/:productID` | Remove from cart |
| POST | `/api/cart/:productID/buy` | Buy an item from cart |
| GET | `/api/saved` | Get saved items |
| POST | `/api/saved` | Save an item |
| DELETE | `/api/saved/:productID` | Unsave an item |
| GET | `/api/transactions/my/purchases` | Get purchases |
| GET | `/api/transactions/my/sales` | Get sales |
| PATCH | `/api/transactions/:id/status` | Update transaction status |
| POST | `/api/reviews` | Submit a review |
| GET | `/api/reviews/user/:userID` | Get reviews for a user |
| GET | `/api/categories` | Get all categories |

---

## Notes

- Product images are stored locally in `backend/uploads/products/`
- The `uploads/` folder is excluded from Git — each instance stores its own images
- Passwords are hashed with bcrypt and never stored in plain text
- JWT tokens expire after 1 day

---

## Built With

- **Frontend** — HTML, CSS, JavaScript (vanilla)
- **Backend** — Node.js, Express.js
- **Database** — Microsoft SQL Server (mssql)
- **Auth** — JSON Web Tokens (jsonwebtoken), bcryptjs
- **File Uploads** — multer

---

## License

This project was built as a school project for National University Manila.
