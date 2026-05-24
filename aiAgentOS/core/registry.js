class Registry {
  constructor() {
    this._modules = [];
  }

  register(module) {
    if (!module.name) {
      throw new Error('模块必须包含 name 属性');
    }
    if (typeof module.init !== 'function') {
      throw new Error(`模块 "${module.name}" 必须实现 init(app, context) 方法`);
    }
    if (this._modules.find(m => m.name === module.name)) {
      throw new Error(`模块 "${module.name}" 已注册，不能重复注册`);
    }

    this._modules.push({
      name: module.name,
      version: module.version || '1.0.0',
      description: module.description || '',
      init: module.init,
      getRoutes: module.getRoutes || (() => []),
      getMetadata: module.getMetadata || (() => ({})),
      _initialized: false
    });

    console.log(`[Registry] 模块已注册: ${module.name} v${module.version || '1.0.0'}`);
    return this;
  }

  initAll(app, context) {
    console.log(`[Registry] 开始初始化 ${this._modules.length} 个模块...`);

    for (const module of this._modules) {
      try {
        module.init(app, context);
        module._initialized = true;
        console.log(`[Registry]   ✓ ${module.name} 初始化完成`);
      } catch (err) {
        console.error(`[Registry]   ✗ ${module.name} 初始化失败:`, err.message);
        throw err;
      }
    }

    console.log(`[Registry] 所有模块初始化完成`);
  }

  getModule(name) {
    return this._modules.find(m => m.name === name) || null;
  }

  listModules() {
    return this._modules.map(m => ({
      name: m.name,
      version: m.version,
      description: m.description,
      initialized: m._initialized,
      routes: m.getRoutes(),
      metadata: m.getMetadata()
    }));
  }
}

module.exports = Registry;
