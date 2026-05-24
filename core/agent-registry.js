class AgentRegistry {
  constructor(store, events) {
    this.agents = new Map();
    this.store = store;
    this.events = events;
  }

  register(agent) {
    if (!agent.id) throw new Error('Agent must have an id');
    if (typeof agent.execute !== 'function') throw new Error(`Agent "${agent.id}" must implement execute(input, context)`);

    this.agents.set(agent.id, {
      id: agent.id,
      name: agent.name || agent.id,
      version: agent.version || '1.0.0',
      description: agent.description || '',
      category: agent.category || 'general',
      status: 'idle',
      execute: agent.execute,
      config: agent.config || {},
      createdAt: new Date().toISOString()
    });

    // 同步到数据库
    const existing = this.store.find('agents', agent.id);
    if (!existing) {
      this.store.insert('agents', {
        id: agent.id,
        name: agent.name || agent.id,
        version: agent.version || '1.0.0',
        description: agent.description || '',
        category: agent.category || 'general',
        status: 'registered',
        enabled: true,
        callCount: 0,
        createdAt: new Date().toISOString()
      });
    }

    this.events.emit('agent:registered', { id: agent.id, name: agent.name });
    console.log(`[Registry] Agent registered: ${agent.id} v${agent.version || '1.0.0'}`);
    return this;
  }

  get(id) { return this.agents.get(id) || null; }

  list() {
    return Array.from(this.agents.values()).map(a => ({
      id: a.id, name: a.name, version: a.version,
      description: a.description, category: a.category, status: a.status
    }));
  }

  async execute(agentId, input, context) {
    const agent = this.agents.get(agentId);
    if (!agent) throw new Error(`Agent "${agentId}" not found`);

    const dbAgent = this.store.find('agents', agentId);
    if (dbAgent && !dbAgent.enabled) throw new Error(`Agent "${agentId}" is disabled`);

    agent.status = 'running';
    this.events.emit('agent:executing', { id: agentId, input });

    const startTime = Date.now();
    try {
      const result = await agent.execute(input, context);
      const duration = Date.now() - startTime;
      agent.status = 'idle';

      // 更新调用计数
      if (dbAgent) {
        this.store.update('agents', agentId, { callCount: (dbAgent.callCount || 0) + 1 });
      }

      this.events.emit('agent:completed', { id: agentId, duration });
      return result;
    } catch (err) {
      agent.status = 'error';
      this.events.emit('agent:error', { id: agentId, error: err.message });
      throw err;
    }
  }
}

module.exports = AgentRegistry;
