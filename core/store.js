const fs = require('fs');
const path = require('path');

class Store {
  constructor(dbPath) {
    this.dbPath = dbPath || path.join(__dirname, '..', 'data', 'db.json');
    this._ensure();
  }

  _ensure() {
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(this.dbPath)) {
      this._write(this._empty());
    }
  }

  _empty() {
    return { users: [], agents: [], tasks: [], logs: [], conversations: [], settings: {} };
  }

  _read() {
    try { return JSON.parse(fs.readFileSync(this.dbPath, 'utf8')); }
    catch { return this._empty(); }
  }

  _write(data) {
    fs.writeFileSync(this.dbPath, JSON.stringify(data, null, 2), 'utf8');
  }

  all(collection) { return this._read()[collection] || []; }

  find(collection, id) { return this.all(collection).find(x => x.id === id) || null; }

  query(collection, fn) { return this.all(collection).filter(fn); }

  insert(collection, item) {
    const db = this._read();
    if (!db[collection]) db[collection] = [];
    db[collection].push(item);
    this._write(db);
    return item;
  }

  update(collection, id, updates) {
    const db = this._read();
    if (!db[collection]) return null;
    const idx = db[collection].findIndex(x => x.id === id);
    if (idx === -1) return null;
    Object.assign(db[collection][idx], updates);
    this._write(db);
    return db[collection][idx];
  }

  remove(collection, id) {
    const db = this._read();
    if (!db[collection]) return false;
    const idx = db[collection].findIndex(x => x.id === id);
    if (idx === -1) return false;
    db[collection].splice(idx, 1);
    this._write(db);
    return true;
  }

  nextId(collection) {
    const items = this.all(collection);
    if (items.length === 0) return '1';
    const max = items.reduce((m, x) => Math.max(m, parseInt(x.id) || 0), 0);
    return (max + 1).toString();
  }
}

module.exports = Store;
