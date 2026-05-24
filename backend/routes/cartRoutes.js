const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const { poolPromise, sql } = require('../config/db');

// ============================================================
// CART ROUTES
// All routes are private (require auth token)
// ============================================================

// --- 1. ADD TO CART ---
// POST /api/cart
// Body: { productID }
// Rules: can't cart your own item, can't cart an already-sold item,
//        can't add same item twice (DB unique constraint handles this)
router.post('/', auth, async (req, res) => {
    const { productID } = req.body;
    const buyerID = req.user.id;

    if (!productID) {
        return res.status(400).json({ message: 'productID is required.' });
    }

    try {
        const pool = await poolPromise;

        // Check product exists, isn't sold, and doesn't belong to the buyer
        const productCheck = await pool.request()
            .input('productID', sql.Int, productID)
            .query('SELECT ProductID, UserID, Status, Quantity FROM Products WHERE ProductID = @productID');

        if (productCheck.recordset.length === 0) {
            return res.status(404).json({ message: 'Product not found.' });
        }

        const product = productCheck.recordset[0];

        if (product.UserID === buyerID) {
            return res.status(400).json({ message: 'You cannot add your own listing to cart.' });
        }
        if (product.Status === 'Sold' || product.Quantity <= 0) {
            return res.status(400).json({ message: 'This item is no longer available.' });
        }

        // Check if already in cart
        const existing = await pool.request()
            .input('userID',    sql.Int, buyerID)
            .input('productID', sql.Int, productID)
            .query('SELECT CartID FROM Cart WHERE UserID = @userID AND ProductID = @productID');

        if (existing.recordset.length > 0) {
            return res.status(400).json({ message: 'Item is already in your cart.' });
        }

        await pool.request()
            .input('userID',    sql.Int, buyerID)
            .input('productID', sql.Int, productID)
            .query('INSERT INTO Cart (UserID, ProductID) VALUES (@userID, @productID)');

        res.status(201).json({ message: 'Item added to cart!' });
    } catch (err) {
        console.error('Add to Cart Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// --- 2. GET MY CART ---
// GET /api/cart
// Returns all cart items with full product + seller info
router.get('/', auth, async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('userID', sql.Int, req.user.id)
            .query(`
                SELECT
                    c.CartID,
                    c.DateAdded,
                    p.ProductID,
                    p.ProductName,
                    p.Price,
                    p.ImageURL,
                    p.ProductCondition,
                    p.Quantity        AS StockLeft,
                    p.Status          AS ProductStatus,
                    p.sellerName,
                    p.Description,
                    cat.CategoryName,
                    u.MessengerLink   AS SellerMessenger,
                    u.UserID          AS SellerID
                FROM Cart c
                JOIN Products  p   ON c.ProductID  = p.ProductID
                JOIN Users     u   ON p.UserID      = u.UserID
                JOIN Categories cat ON p.CategoryID = cat.CategoryID
                WHERE c.UserID = @userID
                ORDER BY c.DateAdded DESC
            `);

        res.json(result.recordset);
    } catch (err) {
        console.error('Get Cart Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// --- 3. REMOVE FROM CART ---
// DELETE /api/cart/:productID
router.delete('/:productID', auth, async (req, res) => {
    const productID = parseInt(req.params.productID);
    const buyerID   = req.user.id;

    try {
        const pool = await poolPromise;

        const check = await pool.request()
            .input('userID',    sql.Int, buyerID)
            .input('productID', sql.Int, productID)
            .query('SELECT CartID FROM Cart WHERE UserID = @userID AND ProductID = @productID');

        if (check.recordset.length === 0) {
            return res.status(404).json({ message: 'Item not found in your cart.' });
        }

        await pool.request()
            .input('userID',    sql.Int, buyerID)
            .input('productID', sql.Int, productID)
            .query('DELETE FROM Cart WHERE UserID = @userID AND ProductID = @productID');

        res.json({ message: 'Item removed from cart.' });
    } catch (err) {
        console.error('Remove from Cart Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// --- 4. CHECKOUT (BUY FROM CART) ---
// POST /api/cart/:productID/buy
// - Decrements Quantity by 1
// - If Quantity hits 0, flips Status to 'Sold'
// - Creates a Transaction (Pending)
// - Removes the item from this buyer's cart
router.post('/:productID/buy', auth, async (req, res) => {
    const productID = parseInt(req.params.productID);
    const buyerID   = req.user.id;

    try {
        const pool = await poolPromise;

        // Verify item is in buyer's cart
        const cartCheck = await pool.request()
            .input('userID',    sql.Int, buyerID)
            .input('productID', sql.Int, productID)
            .query('SELECT CartID FROM Cart WHERE UserID = @userID AND ProductID = @productID');

        if (cartCheck.recordset.length === 0) {
            return res.status(400).json({ message: 'Item is not in your cart.' });
        }

        // Get current product state
        const productCheck = await pool.request()
            .input('productID', sql.Int, productID)
            .query('SELECT ProductID, UserID, Status, Quantity FROM Products WHERE ProductID = @productID');

        if (productCheck.recordset.length === 0) {
            return res.status(404).json({ message: 'Product not found.' });
        }

        const product = productCheck.recordset[0];

        if (product.Quantity <= 0 || product.Status === 'Sold') {
            return res.status(400).json({ message: 'Sorry, this item is no longer available.' });
        }

        const sellerID    = product.UserID;
        const newQuantity = product.Quantity - 1;
        const newStatus   = newQuantity <= 0 ? 'Sold' : 'Available';

        // Decrement quantity (and flip status if needed)
        await pool.request()
            .input('productID',   sql.Int,     productID)
            .input('newQuantity', sql.Int,      newQuantity)
            .input('newStatus',   sql.VarChar,  newStatus)
            .query(`
                UPDATE Products
                SET Quantity = @newQuantity,
                    Status   = @newStatus
                WHERE ProductID = @productID
            `);

        // Create transaction
        const txResult = await pool.request()
            .input('productID', sql.Int, productID)
            .input('buyerID',   sql.Int, buyerID)
            .input('sellerID',  sql.Int, sellerID)
            .query(`
                INSERT INTO Transactions (ProductID, BuyerID, SellerID, Status)
                OUTPUT INSERTED.TransactionID
                VALUES (@productID, @buyerID, @sellerID, 'Pending')
            `);

        const transactionID = txResult.recordset[0].TransactionID;

        // Remove from cart
        await pool.request()
            .input('userID',    sql.Int, buyerID)
            .input('productID', sql.Int, productID)
            .query('DELETE FROM Cart WHERE UserID = @userID AND ProductID = @productID');

        res.status(201).json({
            message: newStatus === 'Sold'
                ? 'Purchase confirmed! This was the last unit — item is now sold out.'
                : 'Purchase confirmed!',
            transactionId: transactionID,
            stockLeft: newQuantity
        });
    } catch (err) {
        console.error('Checkout Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;