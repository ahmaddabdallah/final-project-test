import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import apiRoutes from './routes/api.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import sequelize from './config/database.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8000;

// CORS Configuration - Handle Railway URLs
const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    ...(process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : []),
    ...(process.env.RAILWAY_STATIC_URL ? [process.env.RAILWAY_STATIC_URL] : []),
    ...(process.env.RAILWAY_PUBLIC_DOMAIN ? [process.env.RAILWAY_PUBLIC_DOMAIN] : []),
];

app.use(cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
}));

// Body Parsing Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health Check Endpoint
app.get('/up', (req, res) => {
    res.status(200).json({
        status: 'OK',
        message: 'Server is running',
        environment: process.env.NODE_ENV,
        timestamp: new Date().toISOString()
    });
});

// API Routes
app.use('/api', apiRoutes);

// 404 Handler
app.use(notFoundHandler);

// Global Error Handler
app.use(errorHandler);

// Database Connection & Server Start
const startServer = async () => {
    try {
        console.log('🔗 Attempting to connect to database...');
        console.log(`📍 Host: ${process.env.DB_HOST}`);
        console.log(`🔌 Port: ${process.env.DB_PORT}`);
        console.log(`🗄️ Database: ${process.env.DB_NAME}`);

        // Test database connection with retry logic
        await sequelize.authenticate();
        console.log('✅ Database connection established successfully.');

        // Sync models (create tables if they don't exist)
        await sequelize.sync({ alter: true });
        console.log('✅ Database models synchronized.');

        // Start server
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`🚀 Server running on port ${PORT}`);
            console.log(`📚 API Documentation:`);
            console.log(`   - Health Check: http://localhost:${PORT}/up`);
            console.log(`   - API Base: http://localhost:${PORT}/api`);
        });
    } catch (error) {
        console.error('❌ Unable to start server:', error.message);
        console.error('🔍 Full error:', error);

        // Don't exit immediately in production, allow Railway to retry
        if (process.env.NODE_ENV === 'production') {
            setTimeout(() => {
                console.log('🔄 Retrying database connection...');
                startServer();
            }, 5000);
        } else {
            process.exit(1);
        }
    }
};

startServer();

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('SIGTERM received. Closing HTTP server and database connection...');
    await sequelize.close();
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('SIGINT received. Closing HTTP server and database connection...');
    await sequelize.close();
    process.exit(0);
});

export default app;
