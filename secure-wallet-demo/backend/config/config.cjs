
const fs = require('node:fs');
const path = require('node:path');

require('dotenv').config();

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required');
}

// Prevent URL SSL parameters from overriding the CA configuration.
const databaseUrl = new URL(process.env.DATABASE_URL);
databaseUrl.searchParams.delete('sslmode');
process.env.DATABASE_URL = databaseUrl.toString();

const sslEnabled = process.env.DATABASE_SSL === 'true';

const dialectOptions = sslEnabled
  ? {
      ssl: {
        ca: fs.readFileSync(path.join(__dirname, 'ca.pem'), 'utf8'),
        rejectUnauthorized: true,
      },
    }
  : {};

module.exports = {
  development: {
    use_env_variable: 'DATABASE_URL',
    dialect: 'postgres',
    logging: false,
  },
  test: {
    use_env_variable: 'DATABASE_URL',
    dialect: 'postgres',
    logging: false,
  },
  production: {
    use_env_variable: 'DATABASE_URL',
    dialect: 'postgres',
    logging: false,
    dialectOptions,
  },
};
