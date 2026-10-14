require('dotenv').config();
const app = require('./app');
const { sequelize } = require('./models');
const port = Number(process.env.PORT || 4000);
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) throw new Error('JWT_SECRET must be at least 32 characters');
sequelize.authenticate().then(() => {
  app.listen(port, '0.0.0.0', () => console.log(`Northstar Wallet API listening on ${port}`));
}).catch(err => { console.error('Database connection failed:', err.message); process.exit(1); });
