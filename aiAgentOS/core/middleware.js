const jwt = require('jsonwebtoken');

function authenticateToken(JWT_SECRET) {
  return (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ success: false, message: '未提供身份验证 Token' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
      if (err) return res.status(403).json({ success: false, message: '无效的 Token 或已过期' });
      req.user = user;
      next();
    });
  };
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.user || req.user.role !== role) {
      return res.status(403).json({
        success: false,
        message: `权限不足，仅允许 ${role === 'staff' ? '政务人员' : role} 访问`
      });
    }
    next();
  };
}

function requestLogger(db) {
  return (req, res, next) => {
    const startTime = Date.now();

    // 记录原始 end 方法
    const originalEnd = res.end;
    res.end = function (...args) {
      const duration = Date.now() - startTime;

      // 只记录 /api/ 请求
      if (req.path.startsWith('/api/')) {
        try {
          const logEntry = {
            id: `log-${Date.now()}-${Math.round(Math.random() * 1000)}`,
            timestamp: new Date().toISOString(),
            method: req.method,
            path: req.path,
            userId: req.user ? req.user.id : null,
            userName: req.user ? req.user.name : '未认证',
            statusCode: res.statusCode,
            duration,
            ip: req.ip || req.connection.remoteAddress
          };

          const data = db.read();
          if (!data.logs) data.logs = [];
          data.logs.push(logEntry);

          // 保留最近 5000 条日志
          if (data.logs.length > 5000) {
            data.logs = data.logs.slice(-5000);
          }

          db.write(data);
        } catch (err) {
          console.error('[RequestLogger] 写入日志失败:', err.message);
        }
      }

      originalEnd.apply(res, args);
    };

    next();
  };
}

module.exports = { authenticateToken, requireRole, requestLogger };
