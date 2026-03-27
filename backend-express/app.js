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

// Health Check Endpoint - Railway convention uses /health
app.get('/health', (req, res) => {
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
        // Use Railway's private domain for MySQL to avoid egress fees
        const dbConfig = {
            // Use private domain for Railway MySQL - service name is 'mysql'
            host: process.env.RAILWAY_PRIVATE_DOMAIN ? 'mysql.railway.internal' :
                (process.env.MYSQLHOST || process.env.DB_HOST || 'localhost'),
            port: process.env.MYSQLPORT || process.env.DB_PORT || 3306,
            database: process.env.MYSQLDATABASE || process.env.DB_NAME || 'ecommerce',
            username: process.env.MYSQLUSER || process.env.DB_USER || 'root',
            password: process.env.MYSQLPASSWORD || process.env.DB_PASSWORD || ''
        };

        console.log('🔗 Attempting to connect to database...');
        console.log(`📍 Host: ${dbConfig.host}`);
        console.log(`🔌 Port: ${dbConfig.port}`);
        console.log(`🗄️ Database: ${dbConfig.database}`);
        console.log(`👤 User: ${dbConfig.username}`);
        console.log(`🔑 Password: ${dbConfig.password ? '***' : 'NOT SET'}`);

        // Debug all environment variables
        console.log('🔍 Environment Variables:');
        console.log('NODE_ENV:', process.env.NODE_ENV);
        console.log('RAILWAY_ENVIRONMENT:', process.env.RAILWAY_ENVIRONMENT);
        console.log('RAILWAY_PUBLIC_URL:', process.env.RAILWAY_PUBLIC_URL);
        console.log('RAILWAY_STATIC_URL:', process.env.RAILWAY_STATIC_URL);
        console.log('RAILWAY_PRIVATE_DOMAIN:', process.env.RAILWAY_PRIVATE_DOMAIN);
        console.log('MYSQLHOST:', process.env.MYSQLHOST);
        console.log('MYSQLPORT:', process.env.MYSQLPORT);
        console.log('MYSQLDATABASE:', process.env.MYSQLDATABASE);
        console.log('MYSQLUSER:', process.env.MYSQLUSER);
        console.log('MYSQLPASSWORD:', process.env.MYSQLPASSWORD ? '***' : 'NOT SET');
        console.log('MYSQL_URL:', process.env.MYSQL_URL);

        // Update Sequelize config with Railway private domain
        const sequelize = new Sequelize(
            dbConfig.database,
            dbConfig.username,
            dbConfig.password,
            {
                host: dbConfig.host,
                port: dbConfig.port,
                dialect: 'mysql',
                logging: process.env.NODE_ENV === 'development' ? console.log : false,
                dialectOptions: {
                    // No SSL needed for private networking
                    ssl: false,
                    connectTimeout: 30000,
                    timeout: 30000,
                },
                pool: {
                    max: 5,
                    min: 0,
                    acquire: 30000,
                    idle: 10000,
                },
                retry: {
                    max: 3,
                    timeout: 5000,
                },
            }
        );

        // If no Railway variables, fallback to localhost for development
        if (!process.env.MYSQLHOST && process.env.NODE_ENV === 'production') {
            console.log('❌ Production mode detected but no Railway database configuration found!');
            console.log('💡 Make sure MySQL plugin is added to your Railway service');
            process.exit(1);
        }

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
            console.log(`   - Health Check: http://localhost:${PORT}/health`);
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
