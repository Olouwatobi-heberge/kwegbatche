const { randomUUID } = require("crypto");

module.exports = function traceMiddleware(req, res, next) {
  req.traceId = req.headers["x-trace-id"] || randomUUID();
  res.setHeader("X-Trace-Id", req.traceId);
  next();
};
