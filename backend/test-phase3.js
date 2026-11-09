const http = require('http');
const app = require('./server');
const { getDatabase } = require('./database/connection');

// Use port 0 so the OS assigns an available port automatically.
// This avoids EACCES errors from restricted/reserved port numbers.

function makeRequest(port, path, options = {}) {
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
        port,
        path: encodeURI(path),
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

async function runPhase3Tests() {
  console.log('\n🍲 Starting Phase 3 Surplus Food & Distribution Center Tests...\n');

  const server = app.listen(0, async () => {
    const boundPort = server.address().port;
    const request = (path, options) => makeRequest(boundPort, path, options);
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
      // 1. Obtain Tokens for Different Roles
      // Canteen 1
      const loginCanteen = await request('/api/auth/login', {
        method: 'POST',
        body: { email: 'canteen@campus.edu', password: 'canteen123' },
      });
      const canteenToken = loginCanteen.data?.data?.token;

      // Canteen 2 (Engg Mess)
      const loginCanteen2 = await request('/api/auth/login', {
        method: 'POST',
        body: { email: 'engg.mess@campus.edu', password: 'canteen123' },
      });
      const canteen2Token = loginCanteen2.data?.data?.token;

      // NGO
      const loginNgo = await request('/api/auth/login', {
        method: 'POST',
        body: { email: 'ngo@hopekitchen.org', password: 'ngo123' },
      });
      const ngoToken = loginNgo.data?.data?.token;

      // Volunteer
      const loginVol = await request('/api/auth/login', {
        method: 'POST',
        body: { email: 'volunteer@campus.edu', password: 'volunteer123' },
      });
      const volToken = loginVol.data?.data?.token;

      // Food Safety Officer
      const loginSafety = await request('/api/auth/login', {
        method: 'POST',
        body: { email: 'safety@campus.edu', password: 'safety123' },
      });
      const safetyToken = loginSafety.data?.data?.token;

      // Admin
      const loginAdmin = await request('/api/auth/login', {
        method: 'POST',
        body: { email: 'admin@campus.edu', password: 'admin123' },
      });
      const adminToken = loginAdmin.data?.data?.token;

      assert(!!canteenToken && !!ngoToken && !!safetyToken && !!adminToken, 'Obtained authentication tokens for all test roles');

      // -------------------------------------------------------------
      // PART A: SURPLUS FOOD MANAGEMENT TESTS
      // -------------------------------------------------------------

      // 2. Canteen creates surplus listing
      const validListing = {
        foodName: 'Rajma Chawal',
        category: 'Cooked Meals',
        quantityKg: 35.5,
        preparationDate: new Date().toISOString().slice(0, 10),
        preparationTime: '12:15',
        storageMethod: 'Hot holding',
        storageTemp: '68°C',
        ingredients: 'Red kidney beans, rice, tomato, onion, spices',
        allergens: 'None',
        pickupDeadline: '15:30',
        location: 'Block A, Ground Floor Canteen',
        notes: 'Lunch surplus; freshly prepared today',
      };

      const createRes = await request('/api/surplus', {
        method: 'POST',
        headers: { Authorization: `Bearer ${canteenToken}` },
        body: validListing,
      });
      assert(createRes.statusCode === 201, 'Canteen coordinator creates surplus listing (HTTP 201)');
      assert(createRes.data?.data?.surplus?.foodName === 'Rajma Chawal', 'Listing food name preserved');
      assert(createRes.data?.data?.surplus?.safetyStatus === 'pending', 'Newly created food safety status is pending');
      assert(createRes.data?.data?.surplus?.matchingStatus === 'available', 'Initial matching status is available');
      assert(createRes.data?.data?.surplus?.availableQuantityKg === 35.5, 'Available quantity matches initial quantity');
      const createdSurplusId = createRes.data?.data?.surplus?.id;

      // 3. Reject invalid quantities (<= 0)
      const badQtyRes = await request('/api/surplus', {
        method: 'POST',
        headers: { Authorization: `Bearer ${canteenToken}` },
        body: {
          ...validListing,
          foodName: 'Negative Food',
          quantityKg: -10,
        },
      });
      assert(badQtyRes.statusCode === 400, 'Negative quantity rejected with HTTP 400');

      const zeroQtyRes = await request('/api/surplus', {
        method: 'POST',
        headers: { Authorization: `Bearer ${canteenToken}` },
        body: {
          ...validListing,
          foodName: 'Zero Food',
          quantityKg: 0,
        },
      });
      assert(zeroQtyRes.statusCode === 400, 'Zero quantity rejected with HTTP 400');

      // 4. Reject unauthenticated listing creation
      const noAuthRes = await request('/api/surplus', {
        method: 'POST',
        body: validListing,
      });
      assert(noAuthRes.statusCode === 401, 'Unauthenticated request rejected with HTTP 401');

      // 5. Reject unauthorized role (NGO or Volunteer creating surplus listing)
      const ngoSurplusRes = await request('/api/surplus', {
        method: 'POST',
        headers: { Authorization: `Bearer ${ngoToken}` },
        body: validListing,
      });
      assert(ngoSurplusRes.statusCode === 403, 'NGO user blocked from creating surplus with HTTP 403');

      // 6. View listings and test filtering
      const listRes = await request('/api/surplus?category=Cooked Meals');
      assert(listRes.statusCode === 200, 'GET /api/surplus returns HTTP 200');
      assert(listRes.data?.data?.surplus?.length > 0, 'Category filter returns listings');
      assert(
        listRes.data?.data?.surplus?.every((s) => s.category === 'Cooked Meals'),
        'All returned items match filtered category'
      );

      // 7. View specific listing by ID
      const getByIdRes = await request(`/api/surplus/${createdSurplusId}`);
      assert(getByIdRes.statusCode === 200, 'GET /api/surplus/:id returns HTTP 200');
      assert(getByIdRes.data?.data?.surplus?.canteenName !== undefined, 'Details include canteen name');

      // 8. Prevent user from modifying another canteen's listing
      const otherCanteenUpdateRes = await request(`/api/surplus/${createdSurplusId}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${canteen2Token}` }, // Canteen 2 attempting to edit Canteen 1
        body: { foodName: 'Tampered Food Name' },
      });
      assert(otherCanteenUpdateRes.statusCode === 403, 'Canteen 2 blocked from modifying Canteen 1 listing (HTTP 403)');

      // 9. Owning canteen updates their listing
      const updateRes = await request(`/api/surplus/${createdSurplusId}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${canteenToken}` },
        body: {
          notes: 'Updated notes: Packaged in insulated containers',
          storageTemp: '70°C',
        },
      });
      assert(updateRes.statusCode === 200, 'Owning canteen successfully updates listing (HTTP 200)');
      assert(updateRes.data?.data?.surplus?.storageTemp === '70°C', 'Updated field reflected in response');

      // -------------------------------------------------------------
      // PART B: FOOD SAFETY VERIFICATION TESTS
      // -------------------------------------------------------------

      // 10. Non-safety officer blocked from verifying food safety
      const canteenVerifyRes = await request(`/api/surplus/${createdSurplusId}/safety`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${canteenToken}` },
        body: { safetyStatus: 'verified', notes: 'Self-inspection' },
      });
      assert(canteenVerifyRes.statusCode === 403, 'Canteen user blocked from safety verification endpoint (HTTP 403)');

      const volVerifyRes = await request(`/api/surplus/${createdSurplusId}/safety`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${volToken}` },
        body: { safetyStatus: 'verified' },
      });
      assert(volVerifyRes.statusCode === 403, 'Volunteer blocked from safety verification endpoint (HTTP 403)');

      // 11. Food Safety Officer verifies food safety
      const safetyVerifyRes = await request(`/api/surplus/${createdSurplusId}/safety`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${safetyToken}` },
        body: {
          safetyStatus: 'verified',
          notes: 'Temperature checked at 70°C. Verified compliant with campus food hygiene standards.',
        },
      });
      assert(safetyVerifyRes.statusCode === 200, 'Food Safety Officer successfully verifies listing (HTTP 200)');
      assert(safetyVerifyRes.data?.data?.surplus?.safetyStatus === 'verified', 'Listing safety status updated to verified');

      // 12. Safety Officer rejection test (must cancel listing)
      // Create a test listing to reject
      const tempListingRes = await request('/api/surplus', {
        method: 'POST',
        headers: { Authorization: `Bearer ${canteenToken}` },
        body: {
          ...validListing,
          foodName: 'Spoiled Salad',
          category: 'Vegetables',
        },
      });
      const tempId = tempListingRes.data?.data?.surplus?.id;

      const rejectRes = await request(`/api/surplus/${tempId}/safety`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${safetyToken}` },
        body: {
          safetyStatus: 'rejected',
          notes: 'Temperature abuse observed; storage exceeded 2-hour ambient window.',
        },
      });
      assert(rejectRes.statusCode === 200, 'Food Safety Officer rejects unsafe food (HTTP 200)');
      assert(rejectRes.data?.data?.surplus?.safetyStatus === 'rejected', 'Safety status is rejected');
      assert(rejectRes.data?.data?.surplus?.status === 'cancelled', 'Rejected food status is automatically cancelled');
      assert(rejectRes.data?.data?.surplus?.matchingStatus === 'cancelled', 'Rejected food matching status is cancelled');

      // 13. Safe cancellation of listing
      const cancelRes = await request(`/api/surplus/${createdSurplusId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${canteenToken}` },
      });
      assert(cancelRes.statusCode === 200, 'Owning canteen can safely cancel listing (HTTP 200)');
      assert(cancelRes.data?.data?.surplus?.status === 'cancelled', 'Listing status set to cancelled');
      assert(cancelRes.data?.data?.surplus?.availableQuantityKg === 0, 'Available quantity set to 0 upon cancellation');

      // -------------------------------------------------------------
      // PART C: DISTRIBUTION CENTER MANAGEMENT TESTS
      // -------------------------------------------------------------

      // 14. Register distribution center for an authorized NGO user
      // Create a new NGO user first to test fresh registration
      const newNgoSuffix = Date.now();
      const newNgoReg = await request('/api/auth/register', {
        method: 'POST',
        body: {
          name: 'Pooja Hegde',
          email: `ngo_${newNgoSuffix}@foodforall.org`,
          password: 'password123',
          phone: '+91 98765 33445',
          organization: 'Food For All Care Center',
          role: 'ngo',
        },
      });
      const freshNgoToken = newNgoReg.data?.data?.token;

      // Note: Registration auto-provisions a default center; let's update it or register
      const myCenterRes = await request('/api/centers/my', {
        headers: { Authorization: `Bearer ${freshNgoToken}` },
      });
      assert(myCenterRes.statusCode === 200, 'NGO can retrieve their own center profile via GET /api/centers/my');
      const freshCenterId = myCenterRes.data?.data?.center?.id;

      // 15. Update center details
      const updateCenterRes = await request(`/api/centers/${freshCenterId}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${freshNgoToken}` },
        body: {
          name: 'Food For All Mega Shelter',
          address: '77 Bannerghatta Road, 3.2 km',
          lat: 12.965,
          lng: 77.605,
          travelTimeMin: 14,
          contactPerson: 'Pooja Hegde',
        },
      });
      assert(updateCenterRes.statusCode === 200, 'NGO updates their center details (HTTP 200)');
      assert(updateCenterRes.data?.data?.center?.name === 'Food For All Mega Shelter', 'Center name updated');

      // 16. Update food demand preferences
      const updateDemandRes = await request(`/api/centers/${freshCenterId}/demand`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${freshNgoToken}` },
        body: {
          categories: ['Cooked Meals', 'Rice', 'Vegetables'],
          demandKg: 85,
          urgency: 'high',
          dietaryNotes: 'Prefers mild spices, suitable for shelter residents',
        },
      });
      assert(updateDemandRes.statusCode === 200, 'NGO updates food demand preferences (HTTP 200)');
      assert(updateDemandRes.data?.data?.center?.demandKg === 85, 'Demand quantity updated to 85 kg');
      assert(updateDemandRes.data?.data?.center?.urgency === 'high', 'Urgency updated to high');
      assert(
        updateDemandRes.data?.data?.center?.demandCategories?.includes('Cooked Meals'),
        'Categories include Cooked Meals'
      );

      // 17. Update storage capacity & test integrity rules
      // A. Normal capacity update (backend dynamically calculates available capacity)
      const capUpdateRes = await request(`/api/centers/${freshCenterId}/capacity`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${freshNgoToken}` },
        body: {
          capacityKg: 150,
        },
      });
      assert(capUpdateRes.statusCode === 200, 'Update capacity succeeds (HTTP 200)');
      assert(capUpdateRes.data?.data?.center?.capacityKg === 150, 'Total capacity is 150 kg');
      assert(capUpdateRes.data?.data?.center?.availableCapacityKg === 150, 'Available capacity is dynamically computed as 150 kg');

      // B. Reject negative capacity
      const negCapRes = await request(`/api/centers/${freshCenterId}/capacity`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${freshNgoToken}` },
        body: {
          capacityKg: 150,
          availableCapacityKg: -20,
        },
      });
      assert(negCapRes.statusCode === 400, 'Negative available capacity rejected with HTTP 400');

      // C. Reject available capacity > total capacity
      const overCapRes = await request(`/api/centers/${freshCenterId}/capacity`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${freshNgoToken}` },
        body: {
          capacityKg: 150,
          availableCapacityKg: 200,
        },
      });
      assert(overCapRes.statusCode === 400, 'Available capacity exceeding total capacity rejected with HTTP 400');

      // D. Test capacity reduction below committed allocations
      // Hope Kitchen (center 1) already has 28 kg in committed/accepted allocations from Phase 1 seed
      const hopeCenterRes = await request('/api/centers/1');
      const hopeCenter = hopeCenterRes.data?.data?.center;
      assert(hopeCenter !== null, 'Hope Kitchen (Center 1) found');

      // Try reducing Hope Kitchen total capacity to 10 kg (which is below committed 28 kg)
      const reduceCommittedRes = await request('/api/centers/1/capacity', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${adminToken}` },
        body: {
          capacityKg: 10,
          availableCapacityKg: 5,
        },
      });
      assert(reduceCommittedRes.statusCode === 400, 'Capacity reduction below active committed allocations blocked (HTTP 400)');
      assert(
        reduceCommittedRes.data?.message?.includes('active committed food allocations'),
        'Clear error message explaining active committed allocations'
      );

      // 18. Audit Log Verification
      const db = getDatabase();
      const auditActions = db
        .prepare("SELECT action, COUNT(*) as c FROM audit_logs WHERE action IN ('CREATE_SURPLUS', 'UPDATE_SURPLUS', 'CANCEL_SURPLUS', 'VERIFY_FOOD_SAFETY', 'UPDATE_DEMAND', 'UPDATE_CAPACITY') GROUP BY action")
        .all();
      assert(auditActions.length >= 4, 'Audit logs recorded for Phase 3 operational actions');

      console.log(`\n📊 Phase 3 Test Summary: ${passed}/${total} checks passed.`);
      if (passed === total) {
        console.log('✨ Phase 3 Surplus Food & Distribution Center Management is 100% Verified and Healthy!\n');
      }
    } catch (err) {
      console.error('Phase 3 test execution error:', err);
    } finally {
      server.close(() => {
        console.log('Phase 3 test server closed cleanly.');
        process.exit(passed === total ? 0 : 1);
      });
    }
  });
}

runPhase3Tests();
