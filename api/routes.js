const express = require('express');
const { auth, role } = require('../core/middleware');
const authService = require('../services/auth');

function createRoutes(store, registry, events, secret) {
  const router = express.Router();
  const authenticate = auth(secret);

  // ─── Auth ───
  router.post('/auth/register', (req, res) => {
    const result = authService.register(store, req.body);
    res.status(result.ok ? 201 : 400).json(result);
  });

  router.post('/auth/login', (req, res) => {
    const result = authService.login(store, secret, req.body);
    res.json(result);
  });

  router.get('/auth/me', authenticate, (req, res) => {
    const user = store.find('users', req.user.id);
    if (!user) return res.status(404).json({ ok: false, error: 'User not found' });
    const { passwordHash, ...u } = user;
    res.json({ ok: true, user: u });
  });

  // ─── System ───
  router.get('/system/info', (req, res) => {
    res.json({
      ok: true,
      system: {
        name: 'aiAgentOS',
        version: '1.0.0',
        description: 'AI Agent Operating System',
        uptime: process.uptime(),
        nodeVersion: process.version,
        agents: registry.list().length,
        memoryUsage: process.memoryUsage().heapUsed
      }
    });
  });

  // ─── Agents ───
  router.get('/agents', authenticate, (req, res) => {
    const agents = registry.list();
    const dbAgents = store.all('agents');
    const merged = agents.map(a => {
      const db = dbAgents.find(d => d.id === a.id);
      return { ...a, enabled: db?.enabled ?? true, callCount: db?.callCount ?? 0 };
    });
    res.json({ ok: true, agents: merged });
  });

  router.post('/agents/:id/execute', authenticate, async (req, res) => {
    try {
      const result = await registry.execute(req.params.id, req.body, { store, events });
      res.json({ ok: true, result });
    } catch (err) {
      res.status(400).json({ ok: false, error: err.message });
    }
  });

  router.put('/agents/:id/toggle', authenticate, role('admin'), (req, res) => {
    const agent = store.find('agents', req.params.id);
    if (!agent) return res.status(404).json({ ok: false, error: 'Agent not found' });
    store.update('agents', req.params.id, { enabled: !agent.enabled });
    res.json({ ok: true, enabled: !agent.enabled });
  });

  // ─── Users (admin) ───
  router.get('/users', authenticate, role('admin'), (req, res) => {
    const users = store.all('users').map(u => {
      const { passwordHash, ...rest } = u;
      return rest;
    });
    res.json({ ok: true, users });
  });

  router.put('/users/:id', authenticate, role('admin'), (req, res) => {
    const { role: newRole, disabled } = req.body;
    const updates = {};
    if (newRole) updates.role = newRole;
    if (disabled !== undefined) updates.disabled = disabled;
    const updated = store.update('users', req.params.id, updates);
    if (!updated) return res.status(404).json({ ok: false, error: 'User not found' });
    const { passwordHash, ...u } = updated;
    res.json({ ok: true, user: u });
  });

  // ─── Tasks ───
  router.get('/tasks', authenticate, (req, res) => {
    const tasks = store.all('tasks');
    res.json({ ok: true, tasks });
  });

  // ─── Logs (admin) ───
  router.get('/logs', authenticate, role('admin'), (req, res) => {
    let logs = store.all('logs');
    logs.sort((a, b) => new Date(b.time) - new Date(a.time));
    const { page = 1, limit = 20 } = req.query;
    const p = parseInt(page), l = parseInt(limit);
    res.json({
      ok: true,
      total: logs.length,
      page: p,
      logs: logs.slice((p - 1) * l, p * l)
    });
  });

  // ─── Data Agent: stats/export ───
  router.get('/data/stats', authenticate, async (req, res) => {
    try {
      const result = await registry.execute('data-agent', { action: 'stats' }, { store, events });
      res.json({ ok: true, ...result });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  router.get('/data/export/:collection', authenticate, role('admin'), async (req, res) => {
    try {
      const result = await registry.execute('data-agent', {
        action: 'export', collection: req.params.collection, format: 'csv'
      }, { store, events });
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${req.params.collection}.csv"`);
      res.write('﻿');
      res.end(result.csv || '');
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  router.get('/data/trend', authenticate, async (req, res) => {
    try {
      const result = await registry.execute('data-agent', { action: 'trend' }, { store, events });
      res.json({ ok: true, ...result });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // ─── Users: create / delete (admin) ───
  router.post('/users', authenticate, role('admin'), (req, res) => {
    const { username, password, role: newRole } = req.body;
    if (!username || !password) return res.status(400).json({ ok: false, error: '用户名和密码必填' });
    if (store.all('users').find(u => u.username === username)) {
      return res.status(400).json({ ok: false, error: '用户名已存在' });
    }
    const { hashPassword } = require('../services/auth');
    const user = {
      id: store.nextId('users'),
      username,
      passwordHash: hashPassword(password),
      role: newRole || 'user',
      disabled: false,
      createdAt: new Date().toISOString()
    };
    store.insert('users', user);
    const { passwordHash, ...safe } = user;
    res.status(201).json({ ok: true, user: safe });
  });

  router.delete('/users/:id', authenticate, role('admin'), (req, res) => {
    if (req.params.id === req.user.id) return res.status(400).json({ ok: false, error: '不能删除自己' });
    const removed = store.remove('users', req.params.id);
    if (!removed) return res.status(404).json({ ok: false, error: '用户不存在' });
    res.json({ ok: true });
  });

  // ─── Roles (admin) ───
  router.get('/roles', authenticate, role('admin'), (req, res) => {
    const roles = store.all('roles');
    res.json({ ok: true, roles });
  });

  router.post('/roles', authenticate, role('admin'), (req, res) => {
    const { id, name, description } = req.body;
    if (!id || !name) return res.status(400).json({ ok: false, error: 'ID和名称必填' });
    if (store.find('roles', id)) return res.status(400).json({ ok: false, error: '角色ID已存在' });
    const role = { id, name, description: description || '', createdAt: new Date().toISOString() };
    store.insert('roles', role);
    store.insert('rolePermissions', { roleId: id, permissionIds: [] });
    res.status(201).json({ ok: true, role });
  });

  router.put('/roles/:id', authenticate, role('admin'), (req, res) => {
    const { name, description } = req.body;
    const updates = {};
    if (name) updates.name = name;
    if (description !== undefined) updates.description = description;
    const updated = store.update('roles', req.params.id, updates);
    if (!updated) return res.status(404).json({ ok: false, error: '角色不存在' });
    res.json({ ok: true, role: updated });
  });

  router.delete('/roles/:id', authenticate, role('admin'), (req, res) => {
    if (['admin', 'user'].includes(req.params.id)) {
      return res.status(400).json({ ok: false, error: '不能删除内置角色' });
    }
    store.remove('roles', req.params.id);
    store.remove('rolePermissions', req.params.id);
    res.json({ ok: true });
  });

  // ─── Permissions (admin) ───
  router.get('/permissions', authenticate, role('admin'), (req, res) => {
    const permissions = store.all('permissions');
    const rolePerms = store.all('rolePermissions');
    const roles = store.all('roles');
    res.json({ ok: true, permissions, rolePermissions: rolePerms, roles });
  });

  router.put('/permissions/:roleId', authenticate, role('admin'), (req, res) => {
    const { permissionIds } = req.body;
    if (!Array.isArray(permissionIds)) return res.status(400).json({ ok: false, error: 'permissionIds 必须是数组' });
    const rp = store.find('rolePermissions', req.params.roleId);
    if (!rp) {
      store.insert('rolePermissions', { roleId: req.params.roleId, permissionIds });
    } else {
      store.update('rolePermissions', req.params.roleId, { permissionIds });
    }
    res.json({ ok: true });
  });

  // ─── Data Warehouse (admin) ───
  router.get('/warehouse/overview', authenticate, role('admin'), (req, res) => {
    const collections = ['users', 'agents', 'tasks', 'logs', 'conversations', 'roles', 'permissions'];
    const overview = {};
    collections.forEach(c => {
      const items = store.all(c);
      overview[c] = { count: items.length };
    });
    overview.users.recent = store.all('users').slice(-3).map(u => ({ username: u.username, createdAt: u.createdAt }));
    overview.logs.recent = store.all('logs').slice(-5).map(l => ({ method: l.method, path: l.path, time: l.time }));
    res.json({ ok: true, overview, generatedAt: new Date().toISOString() });
  });

  router.get('/warehouse/export/:collection', authenticate, role('admin'), (req, res) => {
    const items = store.all(req.params.collection);
    if (!items.length) return res.status(404).json({ ok: false, error: '集合为空或不存在' });
    const headers = Object.keys(items[0]);
    const csv = [headers.join(','), ...items.map(row => headers.map(h => {
      const v = row[h];
      const s = typeof v === 'object' ? JSON.stringify(v) : String(v ?? '');
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(','))].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${req.params.collection}.csv"`);
    res.write('﻿');
    res.end(csv);
  });

  router.get('/warehouse/trend', authenticate, role('admin'), (req, res) => {
    const logs = store.all('logs');
    const now = new Date();
    const hours = {};
    for (let i = 23; i >= 0; i--) {
      const d = new Date(now - i * 3600000);
      const key = d.toISOString().slice(0, 13);
      hours[key] = 0;
    }
    logs.forEach(l => {
      const key = l.time?.slice(0, 13);
      if (hours[key] !== undefined) hours[key]++;
    });
    const labels = Object.keys(hours).map(k => k.slice(11) + ':00');
    const data = Object.values(hours);
    res.json({ ok: true, labels, data });
  });

  return router;
}

module.exports = createRoutes;
