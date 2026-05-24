const crypto = require('crypto');
const jwt = require('jsonwebtoken');

function hashPassword(pw, salt) {
  salt = salt || crypto.randomBytes(16).toString('hex');
  return salt + ':' + crypto.createHash('sha256').update(salt + pw).digest('hex');
}

function verifyPassword(pw, stored) {
  return hashPassword(pw, stored.split(':')[0]) === stored;
}

function register(store, { username, password, role }) {
  if (!username || !password) return { ok: false, error: 'Username and password required' };
  if (store.all('users').find(u => u.username === username)) return { ok: false, error: 'Username taken' };

  const user = {
    id: store.nextId('users'),
    username,
    passwordHash: hashPassword(password),
    role: role || 'user',
    disabled: false,
    createdAt: new Date().toISOString()
  };
  store.insert('users', user);
  return { ok: true, user: { id: user.id, username: user.username, role: user.role } };
}

function login(store, secret, { username, password }) {
  const user = store.all('users').find(u => u.username === username);
  if (!user || !verifyPassword(password, user.passwordHash)) return { ok: false, error: 'Invalid credentials' };
  if (user.disabled) return { ok: false, error: 'Account disabled' };

  const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, secret, { expiresIn: '7d' });
  return { ok: true, token, user: { id: user.id, username: user.username, role: user.role } };
}

module.exports = { hashPassword, verifyPassword, register, login };
