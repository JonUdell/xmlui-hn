 // File: server.js
const express = require('express');
const bodyParser = require('body-parser');
const knex = require('knex')({
  client: 'sqlite3',
  connection: {
    filename: './data.db'
  },
  useNullAsDefault: true
});

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());
app.use((req, res, next) => {
  req._startTime = Date.now();
  next();
});

/**
 * Build a dynamic query based on input parameters
 * @param {Object} params - Query parameters
 * @returns {Object} Knex query builder object
 */
function buildDynamicQuery(params) {
  const { term, field, dateRange, limit } = params;

  let query = knex('hn')
    .select([
      'id',
      knex.raw('replace(substr(time, 0, 11), \'-\', \'/\') AS time'),
      'title',
      'by',
      knex.raw('CAST(score AS integer) AS score'),
      knex.raw('CAST(descendants AS integer) AS descendants'),
      'url',
      'fave'
    ]);

  // Add search term condition if provided
  if (term && field) {
    query = query.where(field, 'like', `%${term}%`);
  } else if (term) {
    query = query.where(function() {
      this.where('title', 'like', `%${term}%`)
          .orWhere('url', 'like', `%${term}%`);
    });
  }

  // Add date range conditions if provided
  if (dateRange) {
    if (dateRange.start) {
      query = query.whereRaw('date(substr(time, 0, 11)) >= date(?)', [dateRange.start]);
    }
    if (dateRange.end) {
      query = query.whereRaw('date(substr(time, 0, 11)) <= date(?)', [dateRange.end]);
    }
  }

  // Add ordering
  query = query.orderBy([
    { column: 'time', order: 'desc' },
    { column: knex.raw('CAST(score AS integer)'), order: 'desc' }
  ]);

  // Add limit
  if (limit && !isNaN(limit)) {
    query = query.limit(Math.min(parseInt(limit), 1000)); // Set a maximum limit
  } else {
    query = query.limit(100); // Default limit
  }

  return query;
}

// Endpoint that returns the generated SQL without executing it
app.post('/debug-query', (req, res) => {
  try {
    const query = buildDynamicQuery(req.body);
    const sqlInfo = query.toSQL();

    res.json({
      sql: query.toString(),
      bindings: sqlInfo.bindings,
      method: sqlInfo.method
    });
  } catch (error) {
    res.status(400).json({
      error: error.message
    });
  }
});

// Endpoint that executes the query and returns results
app.post('/execute-query', async (req, res) => {
  try {
    const query = buildDynamicQuery(req.body);

    // Log the SQL for debugging (would be removed in production)
    console.log('Executing SQL:', query.toString());
    console.log('With bindings:', query.toSQL().bindings);

    // Execute the query against the database
    const results = await query;

    // Add execution metrics
    const executionTimeMs = Date.now() - req._startTime;

    res.json({
      count: results.length,
      executionTimeMs,
      results: results
    });
  } catch (error) {
    console.error('Query execution error:', error);
    res.status(500).json({
      error: error.message,
      sqlState: error.sqlState,
      code: error.code
    });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`- Debug endpoint: POST /debug-query`);
  console.log(`- Execute endpoint: POST /execute-query`);
});

// Example usage with curl:
// curl -X POST http://localhost:3000/debug-query \
//   -H "Content-Type: application/json" \
//   -d '{"term": "docker", "field": "title", "dateRange": { "start": "2025-01-01", "end": "2025-01-07" }, "limit": 100}'