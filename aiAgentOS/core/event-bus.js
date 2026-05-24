class EventBus {
  constructor() {
    this._handlers = {};
    this._onceHandlers = {};
  }

  on(event, handler) {
    if (!this._handlers[event]) this._handlers[event] = [];
    this._handlers[event].push(handler);
    return this;
  }

  off(event, handler) {
    if (!this._handlers[event]) return this;
    this._handlers[event] = this._handlers[event].filter(h => h !== handler);
    return this;
  }

  once(event, handler) {
    if (!this._onceHandlers[event]) this._onceHandlers[event] = [];
    this._onceHandlers[event].push(handler);
    return this;
  }

  emit(event, data) {
    // 同步执行所有订阅者
    const handlers = this._handlers[event] || [];
    for (const handler of handlers) {
      try {
        handler(data);
      } catch (err) {
        console.error(`[EventBus] 事件 "${event}" 处理器异常:`, err.message);
      }
    }

    // once 处理器执行后移除
    const onceHandlers = this._onceHandlers[event] || [];
    delete this._onceHandlers[event];
    for (const handler of onceHandlers) {
      try {
        handler(data);
      } catch (err) {
        console.error(`[EventBus] 事件 "${event}" once 处理器异常:`, err.message);
      }
    }

    return this;
  }

  removeAllListeners(event) {
    if (event) {
      delete this._handlers[event];
      delete this._onceHandlers[event];
    } else {
      this._handlers = {};
      this._onceHandlers = {};
    }
    return this;
  }
}

module.exports = EventBus;
