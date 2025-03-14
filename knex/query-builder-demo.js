// File: query-builder-demo.js
const knex = require('knex')({
  client: 'sqlite3', // We're using SQLite for this example
  connection: {
    filename: './data.db' // Path to SQLite database file
  },
  useNullAsDefault: true // Required for SQLite
});

/**
 * Build a dynamic query based on input parameters
 * @param {Object} params - Query parameters
 * @returns {Object} Knex query builder object
 */
function buildQuery(params) {
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
  if (limit) {
    query = query.limit(limit);
  }

  return query;
}

/**
 * Test different query scenarios and execute them against the database
 */
async function runDemo() {
  console.log('=== Knex.js Query Builder Demo ===\n');

  try {
    // Test case 1: All parameters
    const params1 = {
      term: "docker",
      field: "title",
      dateRange: { start: "2025-01-01", end: "2025-01-07" },
      limit: 100
    };

    const query1 = buildQuery(params1);
    console.log('Test Case 1: Search for "docker" in title field');
    console.log('Input:', JSON.stringify(params1, null, 2));
    console.log('Generated SQL:');
    console.log(query1.toString());
    console.log('Bindings:', query1.toSQL().bindings);

    // Execute the query
    console.log('\nExecuting query...');
    const results1 = await query1;
    console.log(`Found ${results1.length} results:`);
    console.table(results1.map(r => ({
      id: r.id,
      time: r.time,
      title: r.title.substring(0, 50) + (r.title.length > 50 ? '...' : ''),
      by: r.by,
      score: r.score
    })));
    console.log('\n');

    // Test case 2: No search term, date range only
    const params2 = {
      dateRange: { start: "2025-01-01", end: "2025-03-14" },
      limit: 10
    };

    const query2 = buildQuery(params2);
    console.log('Test Case 2: Date range only');
    console.log('Input:', JSON.stringify(params2, null, 2));
    console.log('Generated SQL:');
    console.log(query2.toString());
    console.log('Bindings:', query2.toSQL().bindings);

    // Execute the query
    console.log('\nExecuting query...');
    const results2 = await query2;
    console.log(`Found ${results2.length} results:`);
    console.table(results2.map(r => ({
      id: r.id,
      time: r.time,
      title: r.title.substring(0, 50) + (r.title.length > 50 ? '...' : ''),
      by: r.by,
      score: r.score
    })));
    console.log('\n');

    // Test case 3: Search in all fields
    const params3 = {
      term: "javascript",
      limit: 50
    };

    const query3 = buildQuery(params3);
    console.log('Test Case 3: Search for "javascript" in all fields');
    console.log('Input:', JSON.stringify(params3, null, 2));
    console.log('Generated SQL:');
    console.log(query3.toString());
    console.log('Bindings:', query3.toSQL().bindings);

    // Execute the query
    console.log('\nExecuting query...');
    const results3 = await query3;
    console.log(`Found ${results3.length} results:`);
    console.table(results3.map(r => ({
      id: r.id,
      time: r.time,
      title: r.title.substring(0, 50) + (r.title.length > 50 ? '...' : ''),
      by: r.by,
      score: r.score
    })));
    console.log('\n');

    // Get total count of records in database
    const totalCount = await knex('hn').count('* as count').first();
    console.log(`Total records in database: ${totalCount.count}`);

  } catch (error) {
    console.error('Error executing queries:', error);
  } finally {
    // Clean up the knex connection
    await knex.destroy();
    console.log('Database connection closed.');
  }
}

// Run the demo asynchronously
runDemo().catch(err => {
  console.error('Unhandled error in demo:', err);
  process.exit(1);
});