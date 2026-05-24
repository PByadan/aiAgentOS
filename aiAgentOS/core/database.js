const fs = require('fs');
const path = require('path');

class Database {
  constructor(dbPath) {
    this.dbPath = dbPath || path.join(__dirname, '..', '..', 'data', 'db.json');
    this._ensureDir();
  }

  _ensureDir() {
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  read() {
    try {
      const data = fs.readFileSync(this.dbPath, 'utf8');
      return JSON.parse(data);
    } catch (err) {
      console.error('[Database] 读取失败，返回空结构', err.message);
      return this._emptyDB();
    }
  }

  write(data) {
    try {
      fs.writeFileSync(this.dbPath, JSON.stringify(data, null, 2), 'utf8');
    } catch (err) {
      console.error('[Database] 写入失败', err.message);
    }
  }

  _emptyDB() {
    return {
      users: [], policies: [], complaints: [], approvals: [],
      analysisHistory: [], messages: [], logs: [],
      roles: [], permissions: [], rolePermissions: {}
    };
  }

  getCollection(name) {
    const db = this.read();
    return db[name] || [];
  }

  addToCollection(name, item) {
    const db = this.read();
    if (!db[name]) db[name] = [];
    db[name].push(item);
    this.write(db);
    return item;
  }

  findById(name, id) {
    const collection = this.getCollection(name);
    return collection.find(item => item.id === id) || null;
  }

  updateInCollection(name, id, updates) {
    const db = this.read();
    if (!db[name]) return null;
    const index = db[name].findIndex(item => item.id === id);
    if (index === -1) return null;
    Object.assign(db[name][index], updates);
    this.write(db);
    return db[name][index];
  }

  deleteFromCollection(name, id) {
    const db = this.read();
    if (!db[name]) return false;
    const index = db[name].findIndex(item => item.id === id);
    if (index === -1) return false;
    db[name].splice(index, 1);
    this.write(db);
    return true;
  }

  query(name, filterFn) {
    return this.getCollection(name).filter(filterFn);
  }

  getNextId(name) {
    const db = this.read();
    if (!db[name] || db[name].length === 0) return '1';
    const maxId = db[name].reduce((max, item) => {
      const num = parseInt(item.id, 10);
      return isNaN(num) ? max : Math.max(max, num);
    }, 0);
    return (maxId + 1).toString();
  }

  atomicUpdate(name, id, updaterFn) {
    const db = this.read();
    if (!db[name]) return null;
    const index = db[name].findIndex(item => item.id === id);
    if (index === -1) return null;
    updaterFn(db[name][index]);
    this.write(db);
    return db[name][index];
  }

  count(name, filterFn) {
    if (!filterFn) return this.getCollection(name).length;
    return this.query(name, filterFn).length;
  }
}

module.exports = Database;
