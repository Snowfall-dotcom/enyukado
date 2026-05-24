const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { poolPromise, sql } = require('../config/db');

// --- 1. CREATE A TRANSACTION (Private - Buyer) ---
router.post('/', auth, async (req, res) => {
    const { productID } = req.body;
    const buyerID = req.user.id;

    if (!productID) {
        return res.status(400).json({ message: 'ProductID is required.' });
    }

    try {
        const pool = await poolPromise;

        const productCheck = await pool.request()
            .input('productID', sql.Int, productID)
            .query('SELECT ProductID, UserID, Status FROM Products WHERE ProductID = @productID');

        if (productCheck.recordset.length === 0) {
            return res.status(404).json({ message: 'Product not found.' });
        }

        const product = productCheck.recordset[0];

        if (product.UserID === buyerID) {
            return res.status(400).json({ message: 'You cannot buy your own product.' });
        }

        if (product.Status === 'Sold') {
            return res.status(400).json({ message: 'This product has already been sold.' });
        }

        const sellerID = product.UserID;

        const result = await pool.request()
            .input('productID', sql.Int,     productID)
            .input('buyerID',   sql.Int,     buyerID)
            .input('sellerID',  sql.Int,     sellerID)
            .query(`
                INSERT INTO Transactions (ProductID, BuyerID, SellerID, Status)
                OUTPUT INSERTED.TransactionID
                VALUES (@productID, @buyerID, @sellerID, 'Pending')
            `);

        const transactionID = result.recordset[0].TransactionID;

        await pool.request()
            .input('productID', sql.Int, productID)
            .query(`UPDATE Products SET Status = 'Sold' WHERE ProductID = @productID`);

        res.status(201).json({
            message: 'Transaction created! Product is now marked as sold.',
            transactionId: transactionID
        });
    } catch (err) {
        console.error('Create Transaction Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// --- 2. GET MY PURCHASES (Private - Buyer) ---
router.get('/my/purchases', auth, async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('buyerID', sql.Int, req.user.id)
            .query(`
                SELECT 
                    t.TransactionID,
                    t.Status,
                    t.TransactionDate,
                    p.ProductID,
                    p.ProductName,
                    p.Price,
                    p.ImageURL,
                    p.ProductCondition,
                    u.FirstName AS SellerFirstName,
                    u.LastName  AS SellerLastName,
                    u.MessengerLink AS SellerMessenger
                FROM Transactions t
                JOIN Products p ON t.ProductID = p.ProductID
                JOIN Users u    ON t.SellerID  = u.UserID
                WHERE t.BuyerID = @buyerID
                ORDER BY t.TransactionDate DESC
            `);

        res.json(result.recordset);
    } catch (err) {
        console.error('Get Purchases Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// --- 3. GET MY SALES (Private - Seller) ---
router.get('/my/sales', auth, async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('sellerID', sql.Int, req.user.id)
            .query(`
                SELECT 
                    t.TransactionID,
                    t.Status,
                    t.TransactionDate,
                    p.ProductID,
                    p.ProductName,
                    p.Price,
                    p.ImageURL,
                    p.ProductCondition,
                    u.FirstName AS BuyerFirstName,
                    u.LastName  AS BuyerLastName,
                    u.MessengerLink AS BuyerMessenger
                FROM Transactions t
                JOIN Products p ON t.ProductID = p.ProductID
                JOIN Users u    ON t.BuyerID   = u.UserID
                WHERE t.SellerID = @sellerID
                ORDER BY t.TransactionDate DESC
            `);

        res.json(result.recordset);
    } catch (err) {
        console.error('Get Sales Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// --- 4. GET SINGLE TRANSACTION BY ID (Private) ---
// Only the buyer or seller of that transaction can view it
router.get('/:id', auth, async (req, res) => {
    const transactionID = parseInt(req.params.id);
    const userID = req.user.id;

    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('id', sql.Int, transactionID)
            .query(`
                SELECT 
                    t.TransactionID,
                    t.BuyerID,
                    t.SellerID,
                    t.Status,
                    t.TransactionDate,
                    p.ProductID,
                    p.ProductName,
                    p.Price,
                    p.ImageURL,
                    p.ProductCondition,
                    buyer.FirstName  AS BuyerFirstName,
                    buyer.LastName   AS BuyerLastName,
                    seller.FirstName AS SellerFirstName,
                    seller.LastName  AS SellerLastName,
                    seller.MessengerLink AS SellerMessenger
                FROM Transactions t
                JOIN Products p      ON t.ProductID = p.ProductID
                JOIN Users buyer     ON t.BuyerID   = buyer.UserID
                JOIN Users seller    ON t.SellerID  = seller.UserID
                WHERE t.TransactionID = @id
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({ message: 'Transaction not found.' });
        }

        const transaction = result.recordset[0];

        // Only buyer or seller can view this transaction
        if (transaction.BuyerID !== userID && transaction.SellerID !== userID) {
            return res.status(403).json({ message: 'Unauthorized.' });
        }

        res.json(transaction);
    } catch (err) {
        console.error('Get Transaction Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// --- 5. UPDATE TRANSACTION STATUS (Private - Seller only) ---
router.patch('/:id/status', auth, async (req, res) => {
    const transactionID = parseInt(req.params.id);
    const { status } = req.body;
    const userID = req.user.id;

    const validStatuses = ['Pending', 'Completed', 'Cancelled'];
    if (!status || !validStatuses.includes(status)) {
        return res.status(400).json({ message: `Status must be one of: ${validStatuses.join(', ')}` });
    }

    try {
        const pool = await poolPromise;

        const check = await pool.request()
            .input('id', sql.Int, transactionID)
            .query('SELECT SellerID FROM Transactions WHERE TransactionID = @id');

        if (check.recordset.length === 0) {
            return res.status(404).json({ message: 'Transaction not found.' });
        }
        if (check.recordset[0].SellerID !== userID) {
            return res.status(403).json({ message: 'Unauthorized: Only the seller can update this transaction.' });
        }

        await pool.request()
            .input('id',     sql.Int,     transactionID)
            .input('status', sql.VarChar, status)
            .query('UPDATE Transactions SET Status = @status WHERE TransactionID = @id');

        res.json({ message: `Transaction marked as ${status}.` });
    } catch (err) {
        console.error('Update Transaction Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;