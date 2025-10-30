const logger = require('../core/logger');

/**
 * Metrics Middleware - Request Tracking
 * 
 * @description
 * HAFTA 2 - Generic Handler için request tracking middleware
 * 
 * Tracks:
 * - Request count (by resource, method, status)
 * - Response time (by resource)
 * - Error rate
 * - Resource usage patterns
 * 
 * Future:
 * - Prometheus integration
 * - Grafana dashboard
 * - Alerting
 */

// In-memory metrics storage (production'da Redis veya Prometheus kullanılacak)
const metrics = {
  requests: {
    // resource: { method: { status: count } }
  },
  responseTimes: {
    // resource: [time1, time2, ...]
  },
  errors: {
    // resource: { error_type: count }
  }
};

/**
 * Track request metrics
 */
function trackRequest(req, res, next) {
  const startTime = Date.now();
  const resource = req.params.resource || 'unknown';
  const method = req.method;

  // Override res.json to capture status code
  const originalJson = res.json.bind(res);
  const originalSend = res.send.bind(res);

  res.json = function(data) {
    captureMetrics(res.statusCode, startTime);
    return originalJson(data);
  };

  res.send = function(data) {
    captureMetrics(res.statusCode, startTime);
    return originalSend(data);
  };

  function captureMetrics(statusCode, startTime) {
    const responseTime = Date.now() - startTime;

    // Initialize metrics structure
    if (!metrics.requests[resource]) {
      metrics.requests[resource] = {};
    }
    if (!metrics.requests[resource][method]) {
      metrics.requests[resource][method] = {};
    }
    if (!metrics.requests[resource][method][statusCode]) {
      metrics.requests[resource][method][statusCode] = 0;
    }

    // Increment request count
    metrics.requests[resource][method][statusCode]++;

    // Track response time
    if (!metrics.responseTimes[resource]) {
      metrics.responseTimes[resource] = [];
    }
    metrics.responseTimes[resource].push(responseTime);

    // Keep only last 1000 response times (memory management)
    if (metrics.responseTimes[resource].length > 1000) {
      metrics.responseTimes[resource].shift();
    }

    // Track errors (4xx, 5xx)
    if (statusCode >= 400) {
      if (!metrics.errors[resource]) {
        metrics.errors[resource] = {};
      }
      const errorType = statusCode >= 500 ? '5xx' : '4xx';
      metrics.errors[resource][errorType] = (metrics.errors[resource][errorType] || 0) + 1;
    }

    // Log slow requests (>1s)
    if (responseTime > 1000) {
      logger.warn('Slow request detected', {
        resource,
        method,
        responseTime: `${responseTime}ms`,
        statusCode,
        path: req.originalUrl
      });
    }

    // Log (debug level)
    logger.debug('Request metrics', {
      resource,
      method,
      statusCode,
      responseTime: `${responseTime}ms`
    });
  }

  next();
}

/**
 * Get current metrics (for admin/monitoring endpoint)
 */
function getMetrics() {
  const summary = {};

  // Aggregate metrics
  for (const [resource, methods] of Object.entries(metrics.requests)) {
    summary[resource] = {
      totalRequests: 0,
      methods: {},
      avgResponseTime: 0,
      errors: metrics.errors[resource] || {}
    };

    for (const [method, statuses] of Object.entries(methods)) {
      let methodTotal = 0;
      for (const count of Object.values(statuses)) {
        methodTotal += count;
        summary[resource].totalRequests += count;
      }
      summary[resource].methods[method] = methodTotal;
    }

    // Calculate average response time
    const responseTimes = metrics.responseTimes[resource] || [];
    if (responseTimes.length > 0) {
      const sum = responseTimes.reduce((a, b) => a + b, 0);
      summary[resource].avgResponseTime = Math.round(sum / responseTimes.length);
    }
  }

  return {
    summary,
    raw: metrics,
    timestamp: new Date().toISOString()
  };
}

/**
 * Reset metrics (for testing or periodic reset)
 */
function resetMetrics() {
  metrics.requests = {};
  metrics.responseTimes = {};
  metrics.errors = {};
  logger.info('Metrics reset');
}

/**
 * Get top resources (by request count)
 */
function getTopResources(limit = 10) {
  const metricsData = getMetrics();
  const sorted = Object.entries(metricsData.summary)
    .sort((a, b) => b[1].totalRequests - a[1].totalRequests)
    .slice(0, limit)
    .map(([resource, data]) => ({
      resource,
      totalRequests: data.totalRequests,
      avgResponseTime: data.avgResponseTime,
      errorRate: calculateErrorRate(data)
    }));

  return sorted;
}

/**
 * Calculate error rate (4xx + 5xx / total)
 */
function calculateErrorRate(resourceData) {
  const errors = Object.values(resourceData.errors).reduce((a, b) => a + b, 0);
  const total = resourceData.totalRequests;
  return total > 0 ? ((errors / total) * 100).toFixed(2) + '%' : '0%';
}

module.exports = {
  trackRequest,
  getMetrics,
  resetMetrics,
  getTopResources
};

