const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const { poolPromise, sql } = require('../config/db');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');

// ---- Multer: save product images to /uploads/products ----
const productImgDir = path.join(__dirname, '..', 'uploads', 'products');
if (!fs.existsSync(productImgDir)) fs.mkdirSync(productImgDir, { recursive: true });

const productImgStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, productImgDir),
    filename:    (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `product_${req.user.id}_${Date.now()}${ext}`);
    }
});

const productImgUpload = multer({
    storage: productImgStorage,
    limits:  { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (req, file, cb) => {
        const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
        if (allowed.includes(path.extname(file.originalname).toLowerCase())) cb(null, true);
        else cb(new Error('Only image files are allowed.'));
    }
});

// --- 1. GET ALL PRODUCTS (Public) ---
// Supports optional query params:
//   ?search=textbook
//   ?category=Books
//   ?condition=Used
//   ?minPrice=100&maxPrice=500
//   ?status=Available        (Available | Sold)
//   ?sort=price_asc | price_desc | newest (default: newest)
router.get('/', async (req, res) => {
    const { search, category, condition, minPrice, maxPrice, status, sort } = req.query;

    try {
        const pool = await poolPromise;
        const request = pool.request();

        // Only show Available products by default unless status is specified
        let query = `
            SELECT p.*, c.CategoryName
            FROM Products p
            LEFT JOIN Categories c ON p.CategoryID = c.CategoryID
            WHERE 1=1`;

        if (search) {
            request.input('search', sql.VarChar, `%${search}%`);
            query += ` AND (ProductName LIKE @search OR Description LIKE @search OR sellerName LIKE @search)`;
        }
        if (category) {
            request.input('category', sql.VarChar, category);
            query += ` AND p.CategoryID = @category`;
        }
        if (condition) {
            request.input('condition', sql.VarChar, condition);
            query += ` AND ProductCondition = @condition`;
        }
        if (minPrice) {
            request.input('minPrice', sql.Decimal(10, 2), parseFloat(minPrice));
            query += ` AND Price >= @minPrice`;
        }
        if (maxPrice) {
            request.input('maxPrice', sql.Decimal(10, 2), parseFloat(maxPrice));
            query += ` AND Price <= @maxPrice`;
        }
        if (status) {
            request.input('status', sql.VarChar, status);
            query += ` AND p.Status = @status`;
        } else {
            // Default: only show available products on the marketplace
            query += ` AND p.Status = 'Available'`;
        }

        if (sort === 'price_asc')       query += ` ORDER BY p.Price ASC`;
        else if (sort === 'price_desc') query += ` ORDER BY p.Price DESC`;
        else if (sort === 'oldest')     query += ` ORDER BY ISNULL(p.DatePosted, CAST(p.ProductID AS DATETIME)) ASC`;
        else                            query += ` ORDER BY ISNULL(p.DatePosted, CAST(p.ProductID AS DATETIME)) DESC`; // default: newest first

        const result = await request.query(query);
        res.json(result.recordset);
    } catch (err) {
        console.error('Get Products Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// --- 2. GET MY LISTINGS (Private) ---
// Must be defined before /:id to avoid route conflict
router.get('/my/listings', auth, async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('UserID', sql.Int, req.user.id)
            .query('SELECT * FROM Products WHERE UserID = @UserID ORDER BY DatePosted DESC');

        res.json(result.recordset);
    } catch (err) {
        console.error('My Listings Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// --- 3. GET SINGLE PRODUCT BY ID (Public) ---
router.get('/:id', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('id', sql.Int, parseInt(req.params.id))
            .query(`
                SELECT p.*, u.MessengerLink, u.ContactNumber
                FROM Products p
                JOIN Users u ON p.UserID = u.UserID
                WHERE p.ProductID = @id
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({ message: 'Product not found.' });
        }

        res.json(result.recordset[0]);
    } catch (err) {
        console.error('Get Product Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// --- 4. ADD A NEW PRODUCT (Private) ---
// Required: ProductName, Price, ProductCondition, CategoryID
// Optional: Description, Quantity, productImage (file upload)
router.post('/add', auth, productImgUpload.single('productImage'), async (req, res) => {
    const { productName, price, description, productCondition, categoryID, quantity } = req.body;
    const imageURL = req.file ? `http://localhost:5000/uploads/products/${req.file.filename}` : null;

    if (!productName || !price || !productCondition || !categoryID) {
        return res.status(400).json({ message: 'ProductName, Price, ProductCondition, and CategoryID are required.' });
    }

    const userID = req.user.id;

    try {
        const pool = await poolPromise;

        // Get seller's name from Users table — don't trust client for this
        const userResult = await pool.request()
            .input('id', sql.Int, userID)
            .query('SELECT FirstName, LastName FROM Users WHERE UserID = @id');

        const user = userResult.recordset[0];
        const sellerName = user ? `${user.FirstName} ${user.LastName}` : 'Unknown';

        const result = await pool.request()
            .input('userID',           sql.Int,          userID)
            .input('categoryID',       sql.Int,          categoryID)
            .input('productName',      sql.VarChar,      productName)
            .input('description',      sql.VarChar,      description    || null)
            .input('price',            sql.Decimal(10,2), parseFloat(price))
            .input('productCondition', sql.VarChar,      productCondition)
            .input('quantity',         sql.Int,          quantity       || 1)
            .input('imageURL',         sql.VarChar,      imageURL       || null)
            .input('sellerName',       sql.VarChar,      sellerName)
            .query(`
                INSERT INTO Products 
                    (UserID, CategoryID, ProductName, Description, Price, ProductCondition, Quantity, ImageURL, Status, sellerName)
                OUTPUT INSERTED.ProductID
                VALUES 
                    (@userID, @categoryID, @productName, @description, @price, @productCondition, @quantity, @imageURL, 'Available', @sellerName)
            `);

        const newProductId = result.recordset[0].ProductID;
        res.status(201).json({ message: 'Product listed successfully!', productId: newProductId });
    } catch (err) {
        console.error('Add Product Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// --- 5. EDIT A PRODUCT (Private - Owner only) ---
router.put('/:id', auth, productImgUpload.single('productImage'), async (req, res) => {
    const { productName, price, description, productCondition, categoryID, quantity } = req.body;
    const productId = parseInt(req.params.id);
    const userID = req.user.id;

    if (!productName || !price || !productCondition || !categoryID) {
        return res.status(400).json({ message: 'ProductName, Price, ProductCondition, and CategoryID are required.' });
    }

    try {
        const pool = await poolPromise;

        // Verify ownership and get existing image
        const check = await pool.request()
            .input('id', sql.Int, productId)
            .query('SELECT UserID, ImageURL FROM Products WHERE ProductID = @id');

        if (check.recordset.length === 0) {
            return res.status(404).json({ message: 'Product not found.' });
        }
        if (check.recordset[0].UserID !== userID) {
            return res.status(403).json({ message: 'Unauthorized: You do not own this listing.' });
        }

        // Determine final imageURL — use new upload, or keep existing
        let imageURL = check.recordset[0].ImageURL;
        if (req.file) {
            // Delete old file if it was locally stored
            if (imageURL && imageURL.includes('/uploads/products/')) {
                const oldFilename = imageURL.split('/uploads/products/')[1];
                const oldPath = path.join(productImgDir, oldFilename);
                if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
            }
            imageURL = `http://localhost:5000/uploads/products/${req.file.filename}`;
        }

        await pool.request()
            .input('id',               sql.Int,           productId)
            .input('productName',      sql.VarChar,       productName)
            .input('price',            sql.Decimal(10, 2), parseFloat(price))
            .input('description',      sql.VarChar,       description      || null)
            .input('productCondition', sql.VarChar,       productCondition)
            .input('categoryID',       sql.Int,           categoryID)
            .input('quantity',         sql.Int,           quantity         || 1)
            .input('imageURL',         sql.VarChar,       imageURL         || null)
            .query(`
                UPDATE Products
                SET ProductName      = @productName,
                    Price            = @price,
                    Description      = @description,
                    ProductCondition = @productCondition,
                    CategoryID       = @categoryID,
                    Quantity         = @quantity,
                    ImageURL         = @imageURL
                WHERE ProductID = @id
            `);

        res.json({ message: 'Product updated successfully!' });
    } catch (err) {
        console.error('Edit Product Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// --- 6. MARK AS SOLD (Private - Owner only) ---
router.patch('/:id/sold', auth, async (req, res) => {
    const productId = parseInt(req.params.id);
    const userID = req.user.id;

    try {
        const pool = await poolPromise;

        const check = await pool.request()
            .input('id', sql.Int, productId)
            .query('SELECT UserID FROM Products WHERE ProductID = @id');

        if (check.recordset.length === 0) {
            return res.status(404).json({ message: 'Product not found.' });
        }
        if (check.recordset[0].UserID !== userID) {
            return res.status(403).json({ message: 'Unauthorized: You do not own this listing.' });
        }

        await pool.request()
            .input('id', sql.Int, productId)
            .query(`UPDATE Products SET Status = 'Sold' WHERE ProductID = @id`);

        res.json({ message: 'Product marked as sold!' });
    } catch (err) {
        console.error('Mark Sold Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// --- 7. DELETE A PRODUCT (Private - Owner only) ---
router.delete('/:id', auth, async (req, res) => {
    const productId = parseInt(req.params.id);
    const userID = req.user.id;

    try {
        const pool = await poolPromise;

        const check = await pool.request()
            .input('id', sql.Int, productId)
            .query('SELECT UserID FROM Products WHERE ProductID = @id');

        if (check.recordset.length === 0) {
            return res.status(404).json({ message: 'Product not found.' });
        }
        if (check.recordset[0].UserID !== userID) {
            return res.status(403).json({ message: 'Unauthorized: You do not own this listing.' });
        }

        await pool.request()
            .input('id', sql.Int, productId)
            .query('DELETE FROM Products WHERE ProductID = @id');

        res.json({ message: 'Product deleted successfully!' });
    } catch (err) {
        console.error('Delete Product Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;