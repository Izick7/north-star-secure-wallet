const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const User = sequelize.define('User', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  name: { type: DataTypes.STRING(80), allowNull: false },
  email: { type: DataTypes.STRING(254), allowNull: false, unique: true },
  passwordHash: { type: DataTypes.STRING, allowNull: false }
}, { tableName: 'users', underscored: true });

const Wallet = sequelize.define('Wallet', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  userId: { type: DataTypes.UUID, allowNull: false, unique: true },
  currency: { type: DataTypes.STRING(3), allowNull: false, defaultValue: 'NGN' },
  balanceKobo: { type: DataTypes.BIGINT, allowNull: false, defaultValue: 0 }
}, { tableName: 'wallets', underscored: true });

const Transfer = sequelize.define('Transfer', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  senderWalletId: { type: DataTypes.UUID, allowNull: false },
  recipientWalletId: { type: DataTypes.UUID, allowNull: false },
  amountKobo: { type: DataTypes.BIGINT, allowNull: false },
  currency: { type: DataTypes.STRING(3), allowNull: false, defaultValue: 'NGN' },
  note: { type: DataTypes.STRING(140), allowNull: false, defaultValue: '' },
  idempotencyKey: { type: DataTypes.STRING(100), allowNull: false, unique: true },
  status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'completed' }
}, { tableName: 'transfers', underscored: true });

const LedgerEntry = sequelize.define('LedgerEntry', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  transferId: { type: DataTypes.UUID, allowNull: false },
  walletId: { type: DataTypes.UUID, allowNull: false },
  direction: { type: DataTypes.ENUM('debit', 'credit'), allowNull: false },
  amountKobo: { type: DataTypes.BIGINT, allowNull: false }
}, { tableName: 'ledger_entries', underscored: true, updatedAt: false });

User.hasOne(Wallet, { foreignKey: 'userId', onDelete: 'CASCADE' });
Wallet.belongsTo(User, { foreignKey: 'userId' });
Transfer.belongsTo(Wallet, { as: 'sender', foreignKey: 'senderWalletId' });
Transfer.belongsTo(Wallet, { as: 'recipient', foreignKey: 'recipientWalletId' });
Transfer.hasMany(LedgerEntry, { foreignKey: 'transferId' });
LedgerEntry.belongsTo(Transfer, { foreignKey: 'transferId' });

module.exports = { sequelize, User, Wallet, Transfer, LedgerEntry };
