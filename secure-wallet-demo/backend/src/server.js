
require('dotenv').config();

const path = require('path');
const express = require('express');
const app = require('./app');
const { sequelize } = require('./models');

const port = Number(process.env.PORT || 4000);

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters');
}

if (process.env.NODE_ENV === 'production') {
  const frontendPath = path.resolve(
    __dirname,
    '../../frontend/dist'
  );

  app.use(express.static(frontendPath));

  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) {
      return next();
    }

    res.sendFile(path.join(frontendPath, 'index.html'));
  });
}

sequelize.authenticate()
  .then(() => {
    app.listen(port, '0.0.0.0', () => {
      console.log(`Northstar Wallet listening on ${port}`);
    });
  })
  .catch((err) => {
    console.error('Database connection failed:', err.message);
    process.exit(1);
  });

