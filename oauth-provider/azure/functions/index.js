/**
 * Azure Functions entry point (Node.js programming model v4).
 * Registers the three HTTP-triggered functions. `package.json` "main"
 * points here so the Functions host discovers them on startup.
 */
const { app } = require('@azure/functions');
const handlers = require('../handlers');

// HEAD is accepted alongside GET so uptime monitors and `curl -I` get the
// same status/headers a browser would (the Functions host returns 404 for
// methods that are not registered).
app.http('healthz', {
  route: 'healthz',
  methods: ['GET', 'HEAD'],
  authLevel: 'anonymous',
  handler: handlers.healthz,
});

app.http('auth', {
  route: 'auth',
  methods: ['GET', 'HEAD'],
  authLevel: 'anonymous',
  handler: handlers.auth,
});

app.http('callback', {
  route: 'callback',
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: handlers.callback,
});
