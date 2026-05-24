class EventBus {
  constructor() {
    this._listeners = {};
    this._once = {};
  }

  on(event, fn) {
    (this._listeners[event] = this._listeners[event] || []).push(fn);
    return () => this.off(event, fn);
  }

  off(event, fn) {
    if (this._listeners[event]) {
      this._listeners[event] = this._listeners[event].filter(f => f !== fn);
    }
    return this;
  }

  once(event, fn) {
    (this._once[event] = this._once[event] || []).push(fn);
    return this;
  }

  emit(event, data) {
    (this._listeners[event] || []).forEach(fn => {
      try { fn(data); } catch (e) { console.error(`[EventBus] ${event}:`, e.message); }
    });
    (this._once[event] || []).forEach(fn => {
      try { fn(data); } catch (e) { console.error(`[EventBus] ${event}:`, e.message); }
    });
    delete this._once[event];
    return this;
  }
}

module.exports = EventBus;
