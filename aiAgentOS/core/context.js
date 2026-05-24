class Context {
  constructor({ db, events, config, jwt, multer, middleware }) {
    this.db = db;
    this.events = events;
    this.config = config;
    this.jwt = jwt;
    this.multer = multer;
    this.middleware = middleware;
  }
}

module.exports = Context;
