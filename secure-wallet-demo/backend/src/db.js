
const { Sequelize } = require('sequelize');
const fs = require('node:fs');
const path = require('node:path');

require('dotenv').config();

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required');
}

const isProd = process.env.NODE_ENV === 'production';
const sslEnabled = isProd && process.env.DATABASE_SSL === 'true';

// Remove sslmode from the URL so it cannot override our explicit CA settings.
const databaseUrl = new URL(process.env.DATABASE_URL);
databaseUrl.searchParams.delete('sslmode');

const dialectOptions = sslEnabled
  ? {
      ssl: {
        ca: fs.readFileSync(
          path.join(__dirname, '..', 'config', 'ca.pem'),
          'utf8'
        ),
        rejectUnauthorized: true,
      },
    }
  : {};

const sequelize = new Sequelize(databaseUrl.toString(), {
  dialect: 'postgres',
  logging: false,
  pool: { max: 10, min: 0, acquire: 30000, idle: 10000 },
  dialectOptions,
});

module.exports = sequelize;
