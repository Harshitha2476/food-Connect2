const http = require('http');
const app = require('./server');

const TEST_PORT = 5099;

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: TEST_PORT,
        path,
        method: options.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers || {}),
        },
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            resolve({
              statusCode: res.statusCode,
              headers: res.headers,
              data: JSON.parse(body),
            });
          } catch {
            resolve({
              statusCode: res.statusCode,
              headers: res.headers,
              raw: body,
            });
          }
        });
      }
    );
    req.on('error', reject);
    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    req.end();
  });
}

async function runServerTests() {
  console.log('\n🚀 Starting Phase 1 Express Server Integration Tests...\n');

  const server = app.listen(TEST_PORT, async () => {
    let passed = 0;
    let total = 0;

    function assert(condition, name, details = '') {
      total++;
      if (condition) {
        console.log(`  ✅ PASS: ${name}`);
        passed++;
      } else {
        console.error(`  ❌ FAIL: ${name} ${details}`);
      }
    }

    try {
      // 1. Root route
      const rootRes = await request('/');
      assert(rootRes.statusCode === 200, 'Root endpoint returns 200');
      assert(rootRes.data?.status === 'Running', 'Root response indicates Running status');

      // 2. /api endpoint
      const apiRes = await request('/api');
      assert(apiRes.statusCode === 200, '/api returns 200');
      assert(apiRes.data?.success === true, '/api returns success: true');
      assert(!!apiRes.data?.data?.endpoints?.health, '/api lists health endpoint');

      // 3. /api/health endpoint
      const healthRes = await request('/api/health');
      assert(healthRes.statusCode === 200, '/api/health returns 200');
      assert(healthRes.data?.success === true, '/api/health returns success: true');
      assert(healthRes.data?.data?.status === 'UP', '/api/health reports status UP');
      assert(
        healthRes.data?.data?.database?.status === 'connected',
        'Database status reported as connected'
      );
      assert(
        healthRes.data?.data?.database?.records?.users > 0,
        `Seeded users detected in health check (${healthRes.data?.data?.database?.records?.users} users)`
      );

      // 4. 404 Handler for undefined route
      const notFoundRes = await request('/api/unknown-endpoint');
      assert(notFoundRes.statusCode === 404, 'Undefined route triggers 404');
      assert(notFoundRes.data?.success === false, '404 returns success: false');

      console.log(`\n📊 Server Test Summary: ${passed}/${total} checks passed.`);
      if (passed === total) {
        console.log('✨ All Express Server & API tests passed with flying colors!\n');
      }
    } catch (err) {
      console.error('Test execution error:', err);
    } finally {
      server.close(() => {
        console.log('Test server closed cleanly.');
        process.exit(passed === total ? 0 : 1);
      });
    }
  });
}

runServerTests();

