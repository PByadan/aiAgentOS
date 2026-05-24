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

  return router;
}

module.exports = createRoutes;
