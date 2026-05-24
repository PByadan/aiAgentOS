const Database = require('./database');
const EventBus = require('./event-bus');
const Registry = require('./registry');
const Context = require('./context');
const { authenticateToken, requireRole, requestLogger } = require('./middleware');

module.exports = {
  Database,
  EventBus,
  Registry,
  Context,
  middleware: { authenticateToken, requireRole, requestLogger }
};
