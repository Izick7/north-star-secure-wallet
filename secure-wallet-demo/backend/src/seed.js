require('dotenv').config();
const argon2 = require('argon2');
const { sequelize, User, Wallet } = require('./models');
(async () => {
  try {
    await sequelize.authenticate();
    if (process.env.SEED_DEMO !== 'true') { console.log('SEED_DEMO is not true; skipping demo seed.'); return; }
    const demos = [
      { name: 'Demo User', email: 'demo@example.com', password: 'DemoWallet!2026', balance: 10000000 },
      { name: 'Alex Morgan', email: 'alex@example.com', password: 'DemoWallet!2026', balance: 2750000 }
    ];
    for (const d of demos) {
      let user = await User.findOne({ where: { email: d.email } });
      if (!user) user = await User.create({ name: d.name, email: d.email, passwordHash: await argon2.hash(d.password, { type: argon2.argon2id }) });
      const [wallet] = await Wallet.findOrCreate({ where: { userId: user.id }, defaults: { userId: user.id, currency: 'NGN', balanceKobo: d.balance } });
      if (wallet.balanceKobo === '0' || Number(wallet.balanceKobo) === 0) await wallet.update({ balanceKobo: d.balance });
    }
    console.log('Demo accounts: demo@example.com / DemoWallet!2026 and alex@example.com / DemoWallet!2026');
  } catch (e) { console.error('Seed failed:', e.message); process.exitCode = 1; }
  finally { await sequelize.close(); }
})();
