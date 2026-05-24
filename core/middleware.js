const jwt = require('jsonwebtoken');

function auth(secret) {
  return (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ ok: false, error: 'No token' });
    try {
      req.user = jwt.verify(token, secret);
      next();
    } catch {
      res.status(401).json({ ok: false, error: 'Invalid token' });
    }
  };
}

function role(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ ok: false, error: 'Forbidden' });
    }
    next();
  };
}

function logger(store) {
  return (req, res, next) => {
    if (!req.path.startsWith('/api/')) return next();
    const start = Date.now();
    const logPath = req.path;
    const logMethod = req.method;
    res.on('finish', () => {
      store.insert('logs', {
        id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        time: new Date().toISOString(),
        method: logMethod,
        path: logPath,
        userId: req.user?.id || null,
        userName: req.user?.username || '-',
        status: res.statusCode,
        ms: Date.now() - start
      });
    });
    next();
  };
}

module.exports = { auth, role, logger };
