'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('users', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
      name: { type: Sequelize.STRING(80), allowNull: false },
      email: { type: Sequelize.STRING(254), allowNull: false, unique: true },
      password_hash: { type: Sequelize.STRING, allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false }
    });
    await queryInterface.createTable('wallets', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
      user_id: { type: Sequelize.UUID, allowNull: false, unique: true, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
      currency: { type: Sequelize.STRING(3), allowNull: false, defaultValue: 'NGN' },
      balance_kobo: { type: Sequelize.BIGINT, allowNull: false, defaultValue: 0 },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false }
    });
    await queryInterface.createTable('transfers', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
      sender_wallet_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'wallets', key: 'id' } },
      recipient_wallet_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'wallets', key: 'id' } },
      amount_kobo: { type: Sequelize.BIGINT, allowNull: false },
      currency: { type: Sequelize.STRING(3), allowNull: false, defaultValue: 'NGN' },
      note: { type: Sequelize.STRING(140), allowNull: false, defaultValue: '' },
      idempotency_key: { type: Sequelize.STRING(100), allowNull: false, unique: true },
      status: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'completed' },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false }
    });
    await queryInterface.createTable('ledger_entries', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
      transfer_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'transfers', key: 'id' } },
      wallet_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'wallets', key: 'id' } },
      direction: { type: Sequelize.ENUM('debit', 'credit'), allowNull: false },
      amount_kobo: { type: Sequelize.BIGINT, allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false }
    });
    await queryInterface.addIndex('ledger_entries', ['wallet_id', 'created_at']);
    await queryInterface.addConstraint('transfers', { fields: ['sender_wallet_id'], type: 'foreign key', name: 'transfers_sender_wallet_fk', references: { table: 'wallets', field: 'id' }, onDelete: 'RESTRICT' });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('ledger_entries');
    await queryInterface.dropTable('transfers');
    await queryInterface.dropTable('wallets');
    await queryInterface.dropTable('users');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_ledger_entries_direction";');
  }
};
