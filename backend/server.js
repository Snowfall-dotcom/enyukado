const express = require('express');
const cors = require('cors');
const path = require('path');
const { poolPromise } = require('./config/db');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/users',        require('./routes/userRoutes'));
app.use('/api/products',     require('./routes/productRoutes'));
app.use('/api/categories',   require('./routes/categoryRoutes'));
app.use('/api/cart',         require('./routes/cartRoutes'));
app.use('/api/transactions', require('./routes/transactionRoutes'));
app.use('/api/reviews',      require('./routes/reviewRoutes'));
app.use('/api/saved',        require('./routes/savedRoutes'));

app.get('/', (req, res) => res.send('Enyukado API is Live!'));
app.get('/api/status', (req, res) => res.json({ status: 'Online' }));

const startServer = async () => {
    try {
        await poolPromise;
        console.log('✅ SQL Server Connected');
        app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
    } catch (err) {
        console.error('❌ Connection Failed:', err.message);
    }
};

startServer();