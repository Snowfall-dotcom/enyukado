const { poolPromise, sql } = require('../config/db');

exports.getAllProducts = async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query('SELECT * FROM Products');
        res.json(result.recordset);
    } catch (err) {
        res.status(500).send(err.message);
    }
};

exports.createProduct = async (req, res) => {
    const { sellerName, productName, price, description, category, UserID, ProductCondition, CategoryID } = req.body;
    try {
        const pool = await poolPromise;
        await pool.request()
            .input('sellerName', sql.NVarChar, sellerName)
            .input('productName', sql.NVarChar, productName)
            .input('price', sql.Decimal(10, 2), price)
            .input('description', sql.NVarChar, description)
            .input('category', sql.NVarChar, category)
            .input('UserID', sql.Int, UserID)
            .input('ProductCondition', sql.NVarChar, ProductCondition)
            .input('CategoryID', sql.Int, CategoryID)
            .query(`INSERT INTO Products (sellerName, productName, price, description, category, UserID, ProductCondition, CategoryID) 
                    VALUES (@sellerName, @productName, @price, @description, @category, @UserID, @ProductCondition, @CategoryID)`);
        
        res.status(201).json({ message: 'Product listed successfully!' });
    } catch (err) {
        res.status(500).send(err.message);
    }
};