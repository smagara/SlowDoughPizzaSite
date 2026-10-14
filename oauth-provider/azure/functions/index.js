/**
 * Azure Functions entry point (Node.js programming model v4).
 * Registers the three HTTP-triggered functions. `package.json` "main"
 * points here so the Functions host discovers them on startup.
 */
const { app } = require('@azure/functions');
const handlers = require('../handlers');

app.http('healthz', {
  route: 'healthz',
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: handlers.healthz,
});

app.http('auth', {
  route: 'auth',
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: handlers.auth,
});

app.http('callback', {
  route: 'callback',
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: handlers.callback,
});
