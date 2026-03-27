import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

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

// Railway MySQL plugin configuration
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

export default sequelize;
