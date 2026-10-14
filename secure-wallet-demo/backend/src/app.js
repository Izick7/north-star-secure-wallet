require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const { z } = require('zod');
const argon2 = require('argon2');
const { sequelize, User, Wallet, Transfer, LedgerEntry } = require('./models');
const { issueSession, requireAuth, setSessionCookie, originGuard } = require('./security');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', process.env.NODE_ENV === 'production' ? 1 : false);
app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_ORIGIN, credentials: true, methods: ['GET','POST','OPTIONS'], allowedHeaders: ['Content-Type','Idempotency-Key'] }));
app.use(express.json({ limit: '10kb', strict: true }));
app.use(cookieParser());
app.use(originGuard);
app.use((req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many attempts. Try again later.' } });
const transferLimiter = rateLimit({ windowMs: 60 * 1000, limit: 12, standardHeaders: true, legacyHeaders: false });
const emailSchema = z.string().trim().email().max(254).transform(v => v.toLowerCase());
const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: emailSchema,
  password: z.string().min(12).max(128).regex(/[a-z]/).regex(/[A-Z]/).regex(/[0-9]/)
});
const loginSchema = z.object({ email: emailSchema, password: z.string().min(1).max(128) });
function parseAmount(value) {
  if (typeof value !== 'string' || !/^(0|[1-9]\d{0,8})(\.\d{1,2})?$/.test(value)) return null;
  const [whole, fraction = ''] = value.split('.');
  const kobo = Number(whole) * 100 + Number((fraction + '00').slice(0,2));
  return Number.isSafeInteger(kobo) && kobo > 0 ? kobo : null;
}
function safeUser(user, wallet) {
  return { id: user.id, name: user.name, email: user.email, wallet: wallet ? { id: wallet.id, currency: wallet.currency, balance: (Number(wallet.balanceKobo) / 100).toFixed(2) } : null };
}
app.get('/api/health', async (req, res) => {
  try { await sequelize.authenticate(); res.json({ status: 'ok', database: 'connected' }); }
  catch { res.status(503).json({ status: 'error', database: 'unavailable' }); }
});
app.post('/api/auth/register', authLimiter, async (req, res, next) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid registration details', details: parsed.error.issues.map(i => ({ field: i.path.join('.'), message: i.message })) });
    const { name, email, password } = parsed.data;
    const existing = await User.findOne({ where: { email } });
    if (existing) return res.status(409).json({ error: 'An account with this email already exists' });
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    const user = await sequelize.transaction(async t => {
      const created = await User.create({ name, email, passwordHash }, { transaction: t });
      const wallet = await Wallet.create({ userId: created.id, currency: 'NGN', balanceKobo: 0 }, { transaction: t });
      created.setDataValue('newWallet', wallet);
      return created;
    });
    setSessionCookie(res, issueSession(user));
    res.status(201).json({ user: safeUser(user, user.get('newWallet')) });
  } catch (e) { if (e.name === 'SequelizeUniqueConstraintError') return res.status(409).json({ error: 'An account with this email already exists' }); next(e); }
});
app.post('/api/auth/login', authLimiter, async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid email or password' });
    const user = await User.findOne({ where: { email: parsed.data.email } });
    if (!user || !(await argon2.verify(user.passwordHash, parsed.data.password))) return res.status(401).json({ error: 'Invalid email or password' });
    const wallet = await Wallet.findOne({ where: { userId: user.id } });
    setSessionCookie(res, issueSession(user));
    res.json({ user: safeUser(user, wallet) });
  } catch (e) { next(e); }
});
app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('wallet_session', { httpOnly: true, secure: process.env.COOKIE_SECURE === 'true', sameSite: 'lax', path: '/' });
  res.status(204).end();
});
app.get('/api/auth/me', requireAuth, async (req, res, next) => {
  try {
    const user = await User.findByPk(req.userId);
    if (!user) return res.status(401).json({ error: 'Authentication required' });
    const wallet = await Wallet.findOne({ where: { userId: user.id } });
    res.json({ user: safeUser(user, wallet) });
  } catch (e) { next(e); }
});
app.get('/api/wallet', requireAuth, async (req, res, next) => {
  try {
    const wallet = await Wallet.findOne({ where: { userId: req.userId } });
    if (!wallet) return res.status(404).json({ error: 'Wallet not found' });
    res.json({ wallet: { id: wallet.id, currency: wallet.currency, balance: (Number(wallet.balanceKobo) / 100).toFixed(2) } });
  } catch (e) { next(e); }
});
app.get('/api/transfers', requireAuth, async (req, res, next) => {
  try {
    const wallet = await Wallet.findOne({ where: { userId: req.userId } });
    const transfers = await Transfer.findAll({
      where: { [require('sequelize').Op.or]: [{ senderWalletId: wallet.id }, { recipientWalletId: wallet.id }] },
      include: [{ model: Wallet, as: 'sender', attributes: ['id','userId'] }, { model: Wallet, as: 'recipient', attributes: ['id','userId'] }],
      order: [['createdAt','DESC']], limit: 50
    });
    const ids = [...new Set(transfers.flatMap(t => [t.sender.userId, t.recipient.userId]))];
    const users = await User.findAll({ where: { id: ids }, attributes: ['id','name','email'] });
    const byId = Object.fromEntries(users.map(u => [u.id, { name: u.name, email: u.email }]));
    res.json({ transfers: transfers.map(t => ({
      id: t.id, amount: (Number(t.amountKobo)/100).toFixed(2), currency: t.currency, note: t.note,
      status: t.status, createdAt: t.createdAt,
      direction: t.senderWalletId === wallet.id ? 'sent' : 'received',
      counterparty: byId[t.senderWalletId === wallet.id ? t.recipient.userId : t.sender.userId]
    })) });
  } catch (e) { next(e); }
});
app.post('/api/transfers', requireAuth, transferLimiter, async (req, res, next) => {
  const parsed = z.object({
    recipientEmail: emailSchema,
    amount: z.string(),
    note: z.string().trim().max(140).optional().default('')
  }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid transfer details' });
  const amountKobo = parseAmount(parsed.data.amount);
  if (!amountKobo || amountKobo > 100000000) return res.status(400).json({ error: 'Amount must be between ₦0.01 and ₦1,000,000.00' });
  const key = req.get('Idempotency-Key');
  if (!key || !/^[A-Za-z0-9._:-]{12,100}$/.test(key)) return res.status(400).json({ error: 'A valid Idempotency-Key header is required' });
  try {
    const existing = await Transfer.findOne({ where: { idempotencyKey: key } });
    if (existing) {
      const sender = await Wallet.findByPk(existing.senderWalletId);
      if (!sender || sender.userId !== req.userId) return res.status(409).json({ error: 'Idempotency key already used' });
      return res.json({ transfer: { id: existing.id, amount: (Number(existing.amountKobo)/100).toFixed(2), status: existing.status, replayed: true } });
    }
    const senderWallet = await Wallet.findOne({ where: { userId: req.userId } });
    const recipient = await User.findOne({ where: { email: parsed.data.recipientEmail } });
    if (!senderWallet || !recipient) return res.status(404).json({ error: 'Recipient account not found' });
    const recipientWallet = await Wallet.findOne({ where: { userId: recipient.id } });
    if (!recipientWallet || senderWallet.id === recipientWallet.id) return res.status(400).json({ error: 'You cannot transfer to this account' });
    if (senderWallet.currency !== recipientWallet.currency) return res.status(400).json({ error: 'Wallet currencies do not match' });

    const transfer = await sequelize.transaction(async t => {
      const ids = [senderWallet.id, recipientWallet.id].sort();
      const locked = await Wallet.findAll({ where: { id: ids }, order: [['id','ASC']], transaction: t, lock: t.LOCK.UPDATE });
      const sender = locked.find(w => w.id === senderWallet.id);
      const receiver = locked.find(w => w.id === recipientWallet.id);
      if (Number(sender.balanceKobo) < amountKobo) {
        const err = new Error('Insufficient funds'); err.status = 422; throw err;
      }
      sender.balanceKobo = String(Number(sender.balanceKobo) - amountKobo);
      receiver.balanceKobo = String(Number(receiver.balanceKobo) + amountKobo);
      await sender.save({ transaction: t });
      await receiver.save({ transaction: t });
      const record = await Transfer.create({
        senderWalletId: sender.id, recipientWalletId: receiver.id, amountKobo, currency: sender.currency,
        note: parsed.data.note, idempotencyKey: key, status: 'completed'
      }, { transaction: t });
      await LedgerEntry.bulkCreate([
        { transferId: record.id, walletId: sender.id, direction: 'debit', amountKobo },
        { transferId: record.id, walletId: receiver.id, direction: 'credit', amountKobo }
      ], { transaction: t });
      return record;
    });
    res.status(201).json({ transfer: { id: transfer.id, amount: (Number(transfer.amountKobo)/100).toFixed(2), currency: transfer.currency, status: transfer.status } });
  } catch (e) {
    if (e.name === 'SequelizeUniqueConstraintError') return res.status(409).json({ error: 'This idempotency key has already been used. Refresh your transaction history.' });
    next(e);
  }
});
app.use((err, req, res, next) => {
  if (err.status) return res.status(err.status).json({ error: err.message });
  if (process.env.NODE_ENV !== 'test') console.error('Request failed:', err.name || 'Error');
  res.status(500).json({ error: 'An unexpected error occurred' });
});
module.exports = app;
