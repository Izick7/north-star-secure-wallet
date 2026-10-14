const request = require('supertest');
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-only-secret-with-more-than-thirty-two-characters';
process.env.FRONTEND_ORIGIN = 'http://localhost:5173';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgres://wallet:wallet_dev_only@localhost:5432/wallet_test';
const app = require('../src/app');
const { sequelize, User, Wallet, Transfer, LedgerEntry } = require('../src/models');
const origin = { Origin: process.env.FRONTEND_ORIGIN };
let cookieA, cookieB, userA, userB;
beforeAll(async () => {
  await sequelize.authenticate();
  await sequelize.sync({ force: true });
  const register = async (name,email) => {
    const res = await request(app).post('/api/auth/register').set(origin).send({ name, email, password: 'StrongPass12345' });
    expect(res.status).toBe(201);
    return { cookie: res.headers['set-cookie'][0].split(';')[0], user: res.body.user };
  };
  const a = await register('Test Alice','alice@test.example');
  const b = await register('Test Bob','bob@test.example');
  cookieA = a.cookie; cookieB = b.cookie; userA = a.user; userB = b.user;
  await Wallet.update({ balanceKobo: '50000' }, { where: { id: userA.wallet.id } });
});
afterAll(async () => { await sequelize.close(); });
test('rejects writes from a foreign origin', async () => {
  const r = await request(app).post('/api/auth/login').set('Origin','https://attacker.example').send({ email:'alice@test.example', password:'StrongPass12345' });
  expect(r.status).toBe(403);
});
test('requires authentication', async () => {
  const r = await request(app).get('/api/wallet');
  expect(r.status).toBe(401);
});
test('transfers atomically and writes two ledger entries', async () => {
  const r = await request(app).post('/api/transfers').set(origin).set('Cookie',cookieA).set('Idempotency-Key','test-transfer-key-0001')
    .send({ recipientEmail:'bob@test.example', amount:'125.50', note:'Test' });
  expect(r.status).toBe(201);
  const a = await Wallet.findOne({ where:{ userId:userA.id } });
  const b = await Wallet.findOne({ where:{ userId:userB.id } });
  expect(Number(a.balanceKobo)).toBe(37450);
  expect(Number(b.balanceKobo)).toBe(12550);
  expect(await LedgerEntry.count({ where:{ transferId:r.body.transfer.id } })).toBe(2);
});
test('rejects insufficient funds', async () => {
  const r = await request(app).post('/api/transfers').set(origin).set('Cookie',cookieA).set('Idempotency-Key','test-transfer-key-0002')
    .send({ recipientEmail:'bob@test.example', amount:'999999.00' });
  expect(r.status).toBe(422);
});
