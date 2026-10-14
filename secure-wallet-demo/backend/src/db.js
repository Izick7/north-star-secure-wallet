const { Sequelize } = require('sequelize');
require('dotenv').config();
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
const isProd = process.env.NODE_ENV === 'production';
const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: false,
  pool: { max: 10, min: 0, acquire: 30000, idle: 10000 },
  dialectOptions: isProd && process.env.DATABASE_SSL === 'true'
    ? { ssl: { require: true, rejectUnauthorized: false } } : {}
});
module.exports = sequelize;
