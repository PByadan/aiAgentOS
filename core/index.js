const EventBus = require('./event-bus');
const Store = require('./store');
const AgentRegistry = require('./agent-registry');
const { auth, role, logger } = require('./middleware');

module.exports = { EventBus, Store, AgentRegistry, middleware: { auth, role, logger } };
