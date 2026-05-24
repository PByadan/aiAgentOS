module.exports = {
  name: 'data-warehouse',
  version: '1.0.0',
  description: '数据仓库模块 — 统计概览、数据导出、趋势分析、系统日志',

  init(app, context) {
    const { db, middleware } = context;
    const { authenticateToken, requireRole } = middleware;

    // 数据总览
    app.get('/api/admin/data-warehouse/overview', authenticateToken, requireRole('staff'), (req, res) => {
      const users = db.getCollection('users');
      const policies = db.getCollection('policies');
      const complaints = db.getCollection('complaints');
      const approvals = db.getCollection('approvals');

      // 用户统计
      const userStats = { total: users.length };
      users.forEach(u => {
        userStats[u.role] = (userStats[u.role] || 0) + 1;
      });

      // 诉求统计
      const complaintStats = { total: complaints.length };
      complaints.forEach(c => {
        complaintStats[c.status] = (complaintStats[c.status] || 0) + 1;
      });

      // 审批统计
      const approvalStats = { total: approvals.length };
      approvals.forEach(a => {
        approvalStats[a.status] = (approvalStats[a.status] || 0) + 1;
      });

      // 政策分类统计
      const policyStats = { total: policies.length };
      policies.forEach(p => {
        policyStats[p.category] = (policyStats[p.category] || 0) + 1;
      });

      res.json({
        success: true,
        overview: {
          users: userStats,
          complaints: complaintStats,
          approvals: approvalStats,
          policies: policyStats
        }
      });
    });

    // 数据导出 CSV
    app.get('/api/admin/data-warehouse/export', authenticateToken, requireRole('staff'), (req, res) => {
      const { type } = req.query;
      const validTypes = ['users', 'complaints', 'approvals', 'policies'];
      if (!type || !validTypes.includes(type)) {
        return res.status(400).json({ success: false, message: 'type 参数必须为 users/complaints/approvals/policies' });
      }

      const data = db.getCollection(type);
      if (data.length === 0) {
        return res.status(404).json({ success: false, message: '该数据集为空' });
      }

      // 生成 CSV
      const csv = jsonToCSV(data);
      const filename = `${type}_export_${new Date().toISOString().slice(0, 10)}.csv`;

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      // 添加 BOM 以支持 Excel 正确识别 UTF-8
      res.write('﻿');
      res.end(csv);
    });

    // 趋势数据
    app.get('/api/admin/data-warehouse/trends', authenticateToken, requireRole('staff'), (req, res) => {
      const { range } = req.query;
      const complaints = db.getCollection('complaints');
      const approvals = db.getCollection('approvals');
      const now = new Date();

      function inRange(dateStr) {
        const d = new Date(dateStr);
        if (range === 'today') {
          return d.toDateString() === now.toDateString();
        } else if (range === 'month') {
          return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
        }
        return d.getFullYear() === now.getFullYear();
      }

      const filteredComplaints = complaints.filter(c => c.createdAt && inRange(c.createdAt));
      const filteredApprovals = approvals.filter(a => a.createdAt && inRange(a.createdAt));

      // 按时间粒度聚合
      const complaintTrend = aggregateByTime(filteredComplaints, range, now);
      const approvalTrend = aggregateByTime(filteredApprovals, range, now);

      res.json({ success: true, complaintTrend, approvalTrend });
    });

    // 系统日志查询
    app.get('/api/admin/data-warehouse/logs', authenticateToken, requireRole('staff'), (req, res) => {
      const { userId, method, pathPrefix, startDate, endDate, page, limit } = req.query;
      let logs = db.getCollection('logs');

      if (userId) logs = logs.filter(l => l.userId === userId);
      if (method) logs = logs.filter(l => l.method === method.toUpperCase());
      if (pathPrefix) logs = logs.filter(l => l.path && l.path.startsWith(pathPrefix));
      if (startDate) logs = logs.filter(l => new Date(l.timestamp) >= new Date(startDate));
      if (endDate) logs = logs.filter(l => new Date(l.timestamp) <= new Date(endDate + 'T23:59:59'));

      logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      const total = logs.length;
      const pageSize = parseInt(limit) || 20;
      const currentPage = parseInt(page) || 1;
      const startIndex = (currentPage - 1) * pageSize;
      const paginated = logs.slice(startIndex, startIndex + pageSize);

      res.json({ success: true, total, page: currentPage, limit: pageSize, logs: paginated });
    });
  },

  getRoutes() {
    return [
      { method: 'GET', path: '/api/admin/data-warehouse/overview', auth: true, role: 'staff' },
      { method: 'GET', path: '/api/admin/data-warehouse/export', auth: true, role: 'staff' },
      { method: 'GET', path: '/api/admin/data-warehouse/trends', auth: true, role: 'staff' },
      { method: 'GET', path: '/api/admin/data-warehouse/logs', auth: true, role: 'staff' }
    ];
  },

  getMetadata() {
    return { category: '数据', icon: 'database' };
  }
};

// 工具函数：JSON 转 CSV
function jsonToCSV(data) {
  if (!data || data.length === 0) return '';

  // 展平嵌套对象
  const flatData = data.map(item => flattenObject(item));
  const headers = [...new Set(flatData.flatMap(obj => Object.keys(obj)))];

  const rows = flatData.map(row =>
    headers.map(h => {
      const val = row[h] == null ? '' : String(row[h]);
      // 转义双引号，包裹含逗号/换行/双引号的值
      if (val.includes(',') || val.includes('\n') || val.includes('"')) {
        return '"' + val.replace(/"/g, '""') + '"';
      }
      return val;
    }).join(',')
  );

  return [headers.join(','), ...rows].join('\n');
}

function flattenObject(obj, prefix) {
  const result = {};
  for (const key in obj) {
    if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (Array.isArray(obj[key])) {
      result[fullKey] = JSON.stringify(obj[key]);
    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
      Object.assign(result, flattenObject(obj[key], fullKey));
    } else {
      result[fullKey] = obj[key];
    }
  }
  return result;
}

function aggregateByTime(items, range, now) {
  const result = [];
  if (range === 'today') {
    for (let h = 0; h < 24; h++) {
      const label = h.toString().padStart(2, '0') + ':00';
      const count = items.filter(item => {
        const d = new Date(item.createdAt);
        return d.getHours() === h;
      }).length;
      result.push({ date: label, count });
    }
  } else if (range === 'month') {
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    for (let day = 1; day <= daysInMonth; day++) {
      const label = `${now.getMonth() + 1}/${day}`;
      const count = items.filter(item => {
        const d = new Date(item.createdAt);
        return d.getDate() === day;
      }).length;
      result.push({ date: label, count });
    }
  } else {
    for (let m = 1; m <= 12; m++) {
      const label = `${m}月`;
      const count = items.filter(item => {
        const d = new Date(item.createdAt);
        return d.getMonth() === m - 1;
      }).length;
      result.push({ date: label, count });
    }
  }
  return result;
}
