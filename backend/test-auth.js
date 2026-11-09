const http = require('http');
const app = require('./server');
const { getDatabase } = require('./database/connection');

const TEST_PORT = 5098;

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const payload = options.body ? JSON.stringify(options.body) : null;
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    };
    if (payload) {
      headers['Content-Length'] = Buffer.byteLength(payload);
    }

    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: TEST_PORT,
        path,
        method: options.method || 'GET',
        headers,
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
    if (payload) {
      req.write(payload);
    }
    req.end();
  });
}

async function runAuthTests() {
  console.log('\n🔐 Starting Phase 2 Authentication & Authorization Tests...\n');

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
      const uniqueSuffix = Date.now();
      const testUser = {
        name: 'Anita Verma',
        email: `anita_${uniqueSuffix}@campus.edu`,
        password: 'securePassword123',
        phone: '+91 98765 88990',
        organization: 'North Campus Kitchen',
        role: 'canteen',
      };

      // 1. Successful Registration
      const regRes = await request('/api/auth/register', {
        method: 'POST',
        body: testUser,
      });
      assert(regRes.statusCode === 201, 'Successful registration returns HTTP 201');
      assert(regRes.data?.success === true, 'Registration returns success: true');
      assert(!!regRes.data?.data?.token, 'Registration returns JWT token');
      assert(regRes.data?.data?.user?.email === testUser.email, 'Registration returns user email');
      assert(!regRes.data?.data?.user?.password_hash, 'Registration payload never exposes password hash');

      // 2. Duplicate Email Rejection
      const dupRes = await request('/api/auth/register', {
        method: 'POST',
        body: testUser,
      });
      assert(dupRes.statusCode === 409, 'Duplicate email registration returns HTTP 409 Conflict');
      assert(dupRes.data?.success === false, 'Duplicate registration returns success: false');

      // 3. Prevention of Unauthorized Admin Registration
      const unauthorizedAdmin = {
        name: 'Hacker User',
        email: `hacker_${uniqueSuffix}@campus.edu`,
        password: 'password123',
        phone: '+91 99999 00000',
        organization: 'Rogue Entity',
        role: 'admin', // Privileged role attempt
      };
      const adminRegRes = await request('/api/auth/register', {
        method: 'POST',
        body: unauthorizedAdmin,
      });
      assert(adminRegRes.statusCode === 400, 'Public registration rejects role=admin with HTTP 400');
      assert(
        adminRegRes.data?.errors?.some((e) => e.message.includes('Unauthorized role assignment')),
        'Public registration provides clear error for unauthorized role claim'
      );

      // 4. Prevention of Unauthorized Safety Officer Registration
      const unauthorizedSafety = {
        name: 'Fake Inspector',
        email: `inspector_${uniqueSuffix}@campus.edu`,
        password: 'password123',
        phone: '+91 99999 00001',
        organization: 'Fake Board',
        role: 'safety_officer', // Privileged role attempt
      };
      const safetyRegRes = await request('/api/auth/register', {
        method: 'POST',
        body: unauthorizedSafety,
      });
      assert(safetyRegRes.statusCode === 400, 'Public registration rejects role=safety_officer with HTTP 400');

      // 5. Successful Login with Demo Credentials
      const loginRes = await request('/api/auth/login', {
        method: 'POST',
        body: {
          email: 'canteen@campus.edu',
          password: 'canteen123',
        },
      });
      assert(loginRes.statusCode === 200, 'Demo canteen login returns HTTP 200');
      assert(loginRes.data?.success === true, 'Login returns success: true');
      assert(!!loginRes.data?.data?.token, 'Login returns JWT token');
      assert(loginRes.data?.data?.user?.role === 'canteen', 'Login returns correct role');
      assert(!loginRes.data?.data?.user?.password_hash, 'Login response never contains password hash');
      const canteenToken = loginRes.data?.data?.token;

      // 6. Login with newly registered user
      const newLoginRes = await request('/api/auth/login', {
        method: 'POST',
        body: {
          email: testUser.email,
          password: testUser.password,
        },
      });
      assert(newLoginRes.statusCode === 200, 'Login with newly registered user succeeds');

      // 7. Incorrect Password Rejection
      const badPassRes = await request('/api/auth/login', {
        method: 'POST',
        body: {
          email: 'canteen@campus.edu',
          password: 'wrongPassword123',
        },
      });
      assert(badPassRes.statusCode === 401, 'Incorrect password returns HTTP 401 Unauthorized');
      assert(badPassRes.data?.success === false, 'Bad password returns success: false');

      // 8. Non-existent Email Rejection
      const notFoundRes = await request('/api/auth/login', {
        method: 'POST',
        body: {
          email: 'nobody@nonexistent.edu',
          password: 'password123',
        },
      });
      assert(notFoundRes.statusCode === 401, 'Non-existent email returns HTTP 401 Unauthorized');

      // 9. Missing Token Rejection on Protected Route
      const noTokenRes = await request('/api/auth/me');
      assert(noTokenRes.statusCode === 401, 'GET /api/auth/me without token returns HTTP 401');

      // 10. Invalid Token Rejection
      const invalidTokenRes = await request('/api/auth/me', {
        headers: {
          Authorization: 'Bearer invalid.token.payload',
        },
      });
      assert(invalidTokenRes.statusCode === 401, 'GET /api/auth/me with invalid token returns HTTP 401');

      // 11. Successful Profile Retrieval (/api/auth/me)
      const meRes = await request('/api/auth/me', {
        headers: {
          Authorization: `Bearer ${canteenToken}`,
        },
      });
      assert(meRes.statusCode === 200, 'GET /api/auth/me with valid token returns HTTP 200');
      assert(meRes.data?.data?.user?.email === 'canteen@campus.edu', 'Profile returns correct email');
      assert(meRes.data?.data?.user?.canteen !== undefined, 'Profile includes linked canteen information');
      assert(!meRes.data?.data?.user?.password_hash, 'Profile never exposes password_hash');

      // 12. Role-Based Authorization Checks
      // A. Canteen access canteen-only route
      const canteenAuthRes = await request('/api/auth/test/canteen-only', {
        headers: { Authorization: `Bearer ${canteenToken}` },
      });
      assert(canteenAuthRes.statusCode === 200, 'Canteen user allowed on canteen-only route');

      // B. Canteen access admin-only route (Should be Forbidden 403)
      const canteenForbiddenRes = await request('/api/auth/test/admin-only', {
        headers: { Authorization: `Bearer ${canteenToken}` },
      });
      assert(canteenForbiddenRes.statusCode === 403, 'Canteen user blocked from admin-only route with HTTP 403');
      assert(canteenForbiddenRes.data?.success === false, 'Blocked role returns success: false');

      // C. Volunteer login and role checks
      const volLogin = await request('/api/auth/login', {
        method: 'POST',
        body: { email: 'volunteer@campus.edu', password: 'volunteer123' },
      });
      const volToken = volLogin.data?.data?.token;

      const volAuthRes = await request('/api/auth/test/volunteer-only', {
        headers: { Authorization: `Bearer ${volToken}` },
      });
      assert(volAuthRes.statusCode === 200, 'Volunteer user allowed on volunteer-only route');

      const volForbiddenRes = await request('/api/auth/test/canteen-only', {
        headers: { Authorization: `Bearer ${volToken}` },
      });
      assert(volForbiddenRes.statusCode === 403, 'Volunteer user blocked from canteen route with HTTP 403');

      // 13. Admin Privileged User Creation
      const adminLogin = await request('/api/auth/login', {
        method: 'POST',
        body: { email: 'admin@campus.edu', password: 'admin123' },
      });
      const adminToken = adminLogin.data?.data?.token;

      const newOfficer = {
        name: 'Dr. Ramesh Inspector',
        email: `officer_${uniqueSuffix}@campus.edu`,
        password: 'officerPass123',
        phone: '+91 98765 11223',
        organization: 'Campus Safety Board',
        role: 'safety_officer',
      };

      const adminCreateRes = await request('/api/auth/admin/users', {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
        body: newOfficer,
      });
      assert(adminCreateRes.statusCode === 201, 'Admin can provision safety_officer via /api/auth/admin/users');
      assert(adminCreateRes.data?.data?.user?.role === 'safety_officer', 'Created user has safety_officer role');

      // Non-admin attempting to use /api/auth/admin/users
      const nonAdminCreateRes = await request('/api/auth/admin/users', {
        method: 'POST',
        headers: { Authorization: `Bearer ${canteenToken}` },
        body: newOfficer,
      });
      assert(nonAdminCreateRes.statusCode === 403, 'Non-admin blocked from /api/auth/admin/users with HTTP 403');

      // 14. Audit Log Verification
      const db = getDatabase();
      const auditEntries = db
        .prepare("SELECT action, COUNT(*) as count FROM audit_logs WHERE action IN ('USER_REGISTER', 'LOGIN_SUCCESS', 'LOGIN_FAILED_BAD_PASSWORD') GROUP BY action")
        .all();
      assert(auditEntries.length >= 2, 'Audit logs successfully recorded for authentication activities');

      console.log(`\n📊 Authentication Test Summary: ${passed}/${total} checks passed.`);
      if (passed === total) {
        console.log('✨ Phase 2 Authentication & Authorization is 100% Verified and Secure!\n');
      }
    } catch (err) {
      console.error('Test execution error:', err);
    } finally {
      server.close(() => {
        console.log('Auth test server closed cleanly.');
        process.exit(passed === total ? 0 : 1);
      });
    }
  });
}

runAuthTests();

