const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const auth = require('../middleware/auth');
const { poolPromise, sql } = require('../config/db');

// --- 1. REGISTER ---
// Required: firstName, lastName, email, password
// Optional: contactNumber, messengerLink
router.post('/register', async (req, res) => {
    const { firstName, lastName, email, password, contactNumber, messengerLink } = req.body;

    if (!firstName || !lastName || !email || !password) {
        return res.status(400).json({ message: 'First name, last name, email, and password are required.' });
    }

    try {
        const pool = await poolPromise;

        // Check if email is already taken
        const emailCheck = await pool.request()
            .input('email', sql.VarChar, email)
            .query('SELECT UserID FROM Users WHERE Email = @email');

        if (emailCheck.recordset.length > 0) {
            return res.status(400).json({ message: 'Email already registered.' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        await pool.request()
            .input('firstName',     sql.VarChar, firstName)
            .input('lastName',      sql.VarChar, lastName)
            .input('email',         sql.VarChar, email)
            .input('password',      sql.VarChar, hashedPassword)
            .input('contactNumber', sql.VarChar, contactNumber || null)
            .input('messengerLink', sql.VarChar, messengerLink || null)
            .query(`
                INSERT INTO Users (FirstName, LastName, Email, Password, ContactNumber, MessengerLink)
                VALUES (@firstName, @lastName, @email, @password, @contactNumber, @messengerLink)
            `);

        res.status(201).json({ message: 'Registration successful!' });
    } catch (err) {
        console.error('Register Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// --- 2. LOGIN ---
// Uses Email + Password
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required.' });
    }

    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('email', sql.VarChar, email)
            .query('SELECT * FROM Users WHERE Email = @email');

        const user = result.recordset[0];
        if (!user) return res.status(404).json({ message: 'User not found.' });

        const isMatch = await bcrypt.compare(password, user.Password);
        if (!isMatch) return res.status(400).json({ message: 'Invalid credentials.' });

        const token = jwt.sign(
            { id: user.UserID },
            process.env.JWT_SECRET || 'secret123',
            { expiresIn: '1d' }
        );

        res.json({
            token,
            user: {
                id:            user.UserID,
                firstName:     user.FirstName,
                lastName:      user.LastName,
                email:         user.Email,
                contactNumber: user.ContactNumber,
                messengerLink: user.MessengerLink
            }
        });
    } catch (err) {
        console.error('Login Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// --- 3. GET MY PROFILE (Private) ---
router.get('/profile', auth, async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('id', sql.Int, req.user.id)
            .query(`
                SELECT UserID, FirstName, LastName, Email,
                       ContactNumber, MessengerLink, DateCreated, PasswordChangedAt
                FROM Users
                WHERE UserID = @id
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({ message: 'User not found.' });
        }

        res.json(result.recordset[0]);
    } catch (err) {
        console.error('Profile Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// --- 4. UPDATE MY PROFILE (Private) ---
router.put('/profile', auth, async (req, res) => {
    const { firstName, lastName, contactNumber, messengerLink } = req.body;

    if (!firstName || !lastName) {
        return res.status(400).json({ message: 'First name and last name are required.' });
    }

    try {
        const pool = await poolPromise;
        await pool.request()
            .input('id',            sql.Int,     req.user.id)
            .input('firstName',     sql.VarChar, firstName)
            .input('lastName',      sql.VarChar, lastName)
            .input('contactNumber', sql.VarChar, contactNumber || null)
            .input('messengerLink', sql.VarChar, messengerLink || null)
            .query(`
                UPDATE Users
                SET FirstName     = @firstName,
                    LastName      = @lastName,
                    ContactNumber = @contactNumber,
                    MessengerLink = @messengerLink
                WHERE UserID = @id
            `);

        res.json({ message: 'Profile updated successfully!' });
    } catch (err) {
        console.error('Update Profile Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// --- 5. CHANGE PASSWORD (Private) ---
router.put('/change-password', auth, async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: 'Current and new password are required.' });
    }

    if (newPassword.length < 6) {
        return res.status(400).json({ message: 'New password must be at least 6 characters.' });
    }

    try {
        const pool = await poolPromise;

        const result = await pool.request()
            .input('id', sql.Int, req.user.id)
            .query('SELECT Password FROM Users WHERE UserID = @id');

        const user = result.recordset[0];
        if (!user) return res.status(404).json({ message: 'User not found.' });

        const isMatch = await bcrypt.compare(currentPassword, user.Password);
        if (!isMatch) return res.status(400).json({ message: 'Current password is incorrect.' });

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        await pool.request()
            .input('id',       sql.Int,     req.user.id)
            .input('password', sql.VarChar, hashedPassword)
            .query('UPDATE Users SET Password = @password, PasswordChangedAt = GETDATE() WHERE UserID = @id');

        res.json({ message: 'Password changed successfully!' });
    } catch (err) {
        console.error('Change Password Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// --- 6. GET ANY USER'S PUBLIC PROFILE (Public) ---
// Used to view a seller's profile from a product listing
router.get('/:id', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('id', sql.Int, parseInt(req.params.id))
            .query(`
                SELECT UserID, FirstName, LastName,
                       MessengerLink, DateCreated
                FROM Users
                WHERE UserID = @id
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({ message: 'User not found.' });
        }

        res.json(result.recordset[0]);
    } catch (err) {
        console.error('Get User Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;