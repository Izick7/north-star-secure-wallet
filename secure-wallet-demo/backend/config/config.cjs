require('dotenv').config();
const url = process.env.DATABASE_URL;
module.exports = {
  development: { use_env_variable: 'DATABASE_URL', dialect: 'postgres', logging: false },
  test: { use_env_variable: 'DATABASE_URL', dialect: 'postgres', logging: false },
  production: { use_env_variable: 'DATABASE_URL', dialect: 'postgres', logging: false,
    dialectOptions: process.env.DATABASE_SSL === 'true' ? { ssl: { require: true, rejectUnauthorized: false } } : {} }
};
