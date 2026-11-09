const http = require('http');
const fs = require('fs');
const path = require('path');
const app = require('./server');
const { getDatabase } = require('./database/connection');

// Use port 0 so the OS assigns an available port automatically.
// This avoids EACCES errors from restricted/reserved port numbers.

function makeRequest(port, urlPath, options = {}) {
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
        path: encodeURI(urlPath),
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

/**
 * Helper to upload multipart/form-data
 */
function makeUploadMultipart(port) {
  return function uploadMultipart(urlPath, fields, fileField, filename, fileContent, token) {
    return new Promise((resolve, reject) => {
      const boundary = '----WebKitFormBoundary' + Math.random().toString(16).slice(2);
      let postData = '';

      for (const [key, value] of Object.entries(fields)) {
        postData += `--${boundary}\r\n`;
        postData += `Content-Disposition: form-data; name="${key}"\r\n\r\n`;
        postData += `${value}\r\n`;
      }

      if (fileField && filename) {
        postData += `--${boundary}\r\n`;
        postData += `Content-Disposition: form-data; name="${fileField}"; filename="${filename}"\r\n`;
        postData += `Content-Type: image/jpeg\r\n\r\n`;
      }

      const prePayload = Buffer.from(postData, 'utf8');
      const filePayload = Buffer.isBuffer(fileContent) ? fileContent : Buffer.from(fileContent || '', 'binary');
      const postPayload = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8');
      const fullBody = Buffer.concat([prePayload, filePayload, postPayload]);

      const req = http.request(
        {
          hostname: '127.0.0.1',
          port,
          path: encodeURI(urlPath),
          method: 'POST',
          headers: {
            'Content-Type': `multipart/form-data; boundary=${boundary}`,
            'Content-Length': fullBody.length,
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        },
        (res) => {
          let body = '';
          res.on('data', (c) => (body += c));
          res.on('end', () => {
            try {
              resolve({ statusCode: res.statusCode, data: JSON.parse(body) });
            } catch {
              resolve({ statusCode: res.statusCode, raw: body });
            }
          });
        }
      );
      req.on('error', reject);
      req.write(fullBody);
      req.end();
    });
  };
}

async function runReviewTests() {
  console.log('\n🔍 Starting Phase 3 Security Review & Map Feature Tests...\n');

  const server = app.listen(0, async () => {
    const boundPort = server.address().port;
    const request = (urlPath, options) => makeRequest(boundPort, urlPath, options);
    const uploadMultipart = makeUploadMultipart(boundPort);
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
      // 1. Get Tokens
      const canteenLogin = await request('/api/auth/login', {
        method: 'POST',
        body: { email: 'canteen@campus.edu', password: 'canteen123' },
      });
      const canteenToken = canteenLogin.data?.data?.token;

      const ngoLogin = await request('/api/auth/login', {
        method: 'POST',
        body: { email: 'ngo@hopekitchen.org', password: 'ngo123' },
      });
      const ngoToken = ngoLogin.data?.data?.token;

      const safetyLogin = await request('/api/auth/login', {
        method: 'POST',
        body: { email: 'safety@campus.edu', password: 'safety123' },
      });
      const safetyToken = safetyLogin.data?.data?.token;

      const adminLogin = await request('/api/auth/login', {
        method: 'POST',
        body: { email: 'admin@campus.edu', password: 'admin123' },
      });
      const adminToken = adminLogin.data?.data?.token;

      // -------------------------------------------------------------------
      // 1. FOOD SAFETY VALIDATION STRENGTHENING
      // -------------------------------------------------------------------
      const today = new Date().toISOString().slice(0, 10);

      // A. Missing temperature on Hot holding rejected
      const missingTempRes = await request('/api/surplus', {
        method: 'POST',
        headers: { Authorization: `Bearer ${canteenToken}` },
        body: {
          foodName: 'Warm Rice',
          category: 'Rice',
          quantityKg: 10,
          preparationDate: today,
          preparationTime: '12:00',
          storageMethod: 'Hot holding',
          storageTemp: '', // Missing
          ingredients: 'Rice, water',
          allergens: 'None',
          pickupDeadline: '14:00',
          location: 'Block A',
        },
      });
      assert(missingTempRes.statusCode === 400, 'Missing temperature on Hot holding rejected (HTTP 400)');
      assert(
        missingTempRes.data?.errors?.some((e) => e.message.includes('Storage temperature is mandatory')),
        'Clear error that storage temperature is mandatory for Hot holding'
      );

      // B. Invalid temperature format (no unit or non-numeric) rejected
      const badTempRes = await request('/api/surplus', {
        method: 'POST',
        headers: { Authorization: `Bearer ${canteenToken}` },
        body: {
          foodName: 'Warm Rice',
          category: 'Rice',
          quantityKg: 10,
          preparationDate: today,
          preparationTime: '12:00',
          storageMethod: 'Hot holding',
          storageTemp: 'very warm', // Invalid format
          ingredients: 'Rice, water',
          allergens: 'None',
          pickupDeadline: '14:00',
          location: 'Block A',
        },
      });
      assert(badTempRes.statusCode === 400, 'Invalid temperature format without unit rejected (HTTP 400)');

      // C. Valid temperature with unit succeeds
      const validSurplusRes = await request('/api/surplus', {
        method: 'POST',
        headers: { Authorization: `Bearer ${canteenToken}` },
        body: {
          foodName: 'Sambar Rice',
          category: 'Cooked Meals',
          quantityKg: 20,
          preparationDate: today,
          preparationTime: '11:30',
          storageMethod: 'Hot holding',
          storageTemp: '68°C', // Valid numeric + unit
          ingredients: 'Rice, lentils, drumstick, carrot, spices',
          allergens: 'Mustard',
          pickupDeadline: '14:30',
          location: 'Main Canteen Ground Floor',
        },
      });
      assert(validSurplusRes.statusCode === 201, 'Valid temperature with unit succeeds (HTTP 201)');
      const validSurplusId = validSurplusRes.data?.data?.surplus?.id;

      // D. Missing ingredients rejected
      const noIngredientsRes = await request('/api/surplus', {
        method: 'POST',
        headers: { Authorization: `Bearer ${canteenToken}` },
        body: {
          foodName: 'Mystery Stew',
          category: 'Cooked Meals',
          quantityKg: 10,
          preparationDate: today,
          preparationTime: '11:00',
          storageMethod: 'Refrigerated',
          storageTemp: '4°C',
          ingredients: '', // Empty
          allergens: 'None',
          pickupDeadline: '14:00',
          location: 'Block A',
        },
      });
      assert(noIngredientsRes.statusCode === 400, 'Empty ingredients rejected with HTTP 400');

      // E. Missing allergens rejected
      const noAllergensRes = await request('/api/surplus', {
        method: 'POST',
        headers: { Authorization: `Bearer ${canteenToken}` },
        body: {
          foodName: 'Stew',
          category: 'Cooked Meals',
          quantityKg: 10,
          preparationDate: today,
          preparationTime: '11:00',
          storageMethod: 'Refrigerated',
          storageTemp: '4°C',
          ingredients: 'Vegetables, broth',
          allergens: '', // Empty
          pickupDeadline: '14:00',
          location: 'Block A',
        },
      });
      assert(noAllergensRes.statusCode === 400, 'Empty allergens declaration rejected with HTTP 400');

      // F. Deadline before preparation time rejected
      const badDeadlineRes = await request('/api/surplus', {
        method: 'POST',
        headers: { Authorization: `Bearer ${canteenToken}` },
        body: {
          foodName: 'Stew',
          category: 'Cooked Meals',
          quantityKg: 10,
          preparationDate: today,
          preparationTime: '13:00',
          storageMethod: 'Refrigerated',
          storageTemp: '4°C',
          ingredients: 'Vegetables, broth',
          allergens: 'None',
          pickupDeadline: '11:00', // Earlier than preparation time!
          location: 'Block A',
        },
      });
      assert(badDeadlineRes.statusCode === 400, 'Pickup deadline earlier than preparation time rejected (HTTP 400)');

      // G. Safety officer rejection without explanatory notes rejected
      const emptyNotesReject = await request(`/api/surplus/${validSurplusId}/safety`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${safetyToken}` },
        body: {
          safetyStatus: 'rejected',
          notes: '', // Empty notes on rejection
        },
      });
      assert(emptyNotesReject.statusCode === 400, 'Rejection without explanatory reason rejected with HTTP 400');

      // -------------------------------------------------------------------
      // 2. CAPACITY PROTECTION & BACKEND CALCULATION
      // -------------------------------------------------------------------
      // Hope Kitchen (Center 1) has active committed allocations from initial seed (28 kg)
      const center1Res = await request('/api/centers/1');
      assert(center1Res.statusCode === 200, 'Center 1 retrieved');

      // Attempting to reduce total capacity below committed allocations (28 kg)
      const badCapReduce = await request('/api/centers/1/capacity', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${adminToken}` },
        body: {
          capacityKg: 20, // Below 28 kg committed
        },
      });
      assert(badCapReduce.statusCode === 400, 'Reducing total capacity below committed allocations blocked (HTTP 400)');
      assert(
        badCapReduce.data?.message?.includes('active committed food allocations'),
        'Error explicitly cites active committed food allocations'
      );

      // Backend authoritatively computes available capacity when total capacity is adjusted
      const validCapAdjust = await request('/api/centers/1/capacity', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${adminToken}` },
        body: {
          capacityKg: 150, // Increase from 120 to 150
        },
      });
      assert(validCapAdjust.statusCode === 200, 'Total capacity update to 150 kg succeeds (HTTP 200)');
      // Available capacity must be dynamically calculated as 150 - committed (28) = 122 kg
      assert(
        validCapAdjust.data?.data?.center?.availableCapacityKg === 122,
        'Available capacity dynamically calculated by backend (150 - 28 committed = 122 kg)'
      );

      // -------------------------------------------------------------------
      // 3. API PRIVACY CHECKS
      // -------------------------------------------------------------------
      // A. Public GET /api/surplus masks coordinator phone number
      const publicSurplus = await request('/api/surplus');
      assert(publicSurplus.statusCode === 200, 'Public GET /api/surplus returns HTTP 200');
      const publicItem = publicSurplus.data?.data?.surplus?.[0];
      assert(
        publicItem?.coordinatorPhone?.includes('***'),
        'Public caller receives masked coordinator phone (privacy protected)'
      );

      // B. Public GET /api/centers masks contact person phone number
      const publicCenters = await request('/api/centers');
      assert(publicCenters.statusCode === 200, 'Public GET /api/centers returns HTTP 200');
      const publicCenter = publicCenters.data?.data?.centers?.[0];
      assert(
        publicCenter?.contactPhone?.includes('***'),
        'Public caller receives masked center contact phone (privacy protected)'
      );

      // C. Authenticated canteen coordinator calling /api/surplus/my gets full unmasked phone
      const mySurplus = await request('/api/surplus/my', {
        headers: { Authorization: `Bearer ${canteenToken}` },
      });
      assert(mySurplus.statusCode === 200, 'Authenticated GET /api/surplus/my succeeds');
      const myItem = mySurplus.data?.data?.surplus?.[0];
      assert(
        myItem?.coordinatorPhone && !myItem?.coordinatorPhone?.includes('***'),
        'Canteen coordinator receives unmasked phone on their own listing'
      );

      // -------------------------------------------------------------------
      // 4. IMAGE UPLOAD SECURITY
      // -------------------------------------------------------------------
      // A. Disguised malicious/text file uploaded as image is rejected by magic byte inspection
      const fakeExecutableContent = Buffer.from('MZ...This is not a real image executable payload');
      const fakeUploadRes = await uploadMultipart(
        '/api/surplus',
        {
          foodName: 'Trojan Food',
          category: 'Cooked Meals',
          quantityKg: '15',
          preparationDate: today,
          preparationTime: '11:00',
          storageMethod: 'Hot holding',
          storageTemp: '65°C',
          ingredients: 'Rice, spices',
          allergens: 'None',
          pickupDeadline: '15:00',
          location: 'Block A',
        },
        'photo',
        'virus.jpg', // Disguised with image extension
        fakeExecutableContent,
        canteenToken
      );
      assert(fakeUploadRes.statusCode === 400, 'Disguised non-image file rejected by magic byte inspection (HTTP 400)');

      // B. Valid JPEG magic bytes upload passes
      // JPEG magic numbers: 0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46
      const validJpegBytes = Buffer.from([
        0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
      ]);
      const validUploadRes = await uploadMultipart(
        '/api/surplus',
        {
          foodName: 'Biryani With Photo',
          category: 'Cooked Meals',
          quantityKg: '18',
          preparationDate: today,
          preparationTime: '11:30',
          storageMethod: 'Hot holding',
          storageTemp: '66°C',
          ingredients: 'Rice, vegetables, ghee',
          allergens: 'Dairy',
          pickupDeadline: '15:00',
          location: 'Block A Ground Floor',
        },
        'photo',
        'real_food.jpg',
        validJpegBytes,
        canteenToken
      );
      assert(validUploadRes.statusCode === 201, 'Valid JPEG binary magic bytes upload succeeds (HTTP 201)');
      assert(!!validUploadRes.data?.data?.surplus?.photoUrl, 'Photo URL stored for valid image upload');
      const photoId = validUploadRes.data?.data?.surplus?.id;

      // -------------------------------------------------------------------
      // 5. CANCELLATION & REJECTION CONSISTENCY
      // -------------------------------------------------------------------
      // Safety Officer verifies photo listing
      await request(`/api/surplus/${photoId}/safety`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${safetyToken}` },
        body: { safetyStatus: 'verified', notes: 'Temperature and visual inspection passed' },
      });

      // Canteen cancels listing: verifies available quantity is zeroed
      const cancelPhotoRes = await request(`/api/surplus/${photoId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${canteenToken}` },
      });
      assert(cancelPhotoRes.statusCode === 200, 'Safe cancellation succeeds (HTTP 200)');
      assert(cancelPhotoRes.data?.data?.surplus?.availableQuantityKg === 0, 'Available quantity set to 0 upon cancellation');
      assert(cancelPhotoRes.data?.data?.surplus?.status === 'cancelled', 'Status set to cancelled');

      // -------------------------------------------------------------------
      // 6. NEARBY DISTRIBUTION CENTERS MAP API (GET /api/matching/nearby/:surplusId)
      // -------------------------------------------------------------------
      // A. Verified surplus listing finds nearby centers with road transit calculations
      // First, verify validSurplusId
      await request(`/api/surplus/${validSurplusId}/safety`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${safetyToken}` },
        body: { safetyStatus: 'verified', notes: 'Verified compliant for redistribution' },
      });

      const mapRes = await request(`/api/matching/nearby/${validSurplusId}`);
      assert(mapRes.statusCode === 200, 'GET /api/matching/nearby/:surplusId returns HTTP 200');
      assert(mapRes.data?.success === true, 'Map API returns success: true');
      assert(!!mapRes.data?.data?.canteen?.lat, 'Map API includes canteen latitude marker');
      assert(!!mapRes.data?.data?.canteen?.lng, 'Map API includes canteen longitude marker');
      assert(mapRes.data?.data?.routingMetadata?.provider === 'simulated_osrm_road_network', 'Explicit routing provider indicated');
      assert(mapRes.data?.data?.routingMetadata?.isLiveRouting === false, 'Explicitly marked as simulated road network (not live GPS)');

      const mapCenters = mapRes.data?.data?.centers;
      assert(Array.isArray(mapCenters) && mapCenters.length > 0, 'Map API returns list of distribution centers');

      // Check center structure
      const firstCenter = mapCenters[0];
      assert(firstCenter?.centerId !== undefined, 'Center has centerId');
      assert(firstCenter?.lat !== undefined && firstCenter?.lng !== undefined, 'Center has coordinates');
      assert(firstCenter?.estimatedDistanceKm > 0, 'Center has estimated road distance in km');
      assert(firstCenter?.estimatedTravelTimeMin > 0, 'Center has estimated travel time in minutes');
      assert(firstCenter?.routeGeometry?.length >= 2, 'Center has route waypoints geometry for Leaflet polyline');
      assert(firstCenter?.isEligible !== undefined, 'Center has eligibility status flag');

      // B. Distinguishes eligible centers (travel time <= 15 min, has capacity, demand matches)
      const eligibleCenters = mapCenters.filter((c) => c.isEligible);
      assert(eligibleCenters.length > 0, 'At least one center identified as eligible');
      assert(
        eligibleCenters.every((c) => c.estimatedTravelTimeMin <= 15),
        'All eligible centers have road travel time <= 15 minutes'
      );

      // C. Distinguishes ineligible centers (e.g. Green Earth Foundation is 22 min away)
      const distantCenter = mapCenters.find((c) => c.estimatedTravelTimeMin > 15);
      if (distantCenter) {
        assert(distantCenter.isEligible === false, 'Center with travel time > 15 min marked as ineligible');
        assert(
          distantCenter.ineligibilityReasons?.some((r) => r.includes('15-minute transit window')),
          'Ineligibility reason clearly states travel time exceeded 15 minutes'
        );
      }

      // D. Unverified food listing marks all centers as ineligible for matching
      // Create an unverified surplus listing
      const unverifiedRes = await request('/api/surplus', {
        method: 'POST',
        headers: { Authorization: `Bearer ${canteenToken}` },
        body: {
          foodName: 'Pending Fruit Mix',
          category: 'Fruits',
          quantityKg: 12,
          preparationDate: today,
          preparationTime: '10:00',
          storageMethod: 'Refrigerated',
          storageTemp: '4°C',
          ingredients: 'Apples, oranges, watermelon',
          allergens: 'None',
          pickupDeadline: '16:00',
          location: 'Block A',
        },
      });
      const unverifiedId = unverifiedRes.data?.data?.surplus?.id;

      const unverifiedMapRes = await request(`/api/matching/nearby/${unverifiedId}`);
      assert(unverifiedMapRes.statusCode === 200, 'Map API handles unverified surplus listing');
      assert(
        unverifiedMapRes.data?.data?.centers?.every((c) => !c.isEligible),
        'All centers marked ineligible when surplus food safety is unverified (pending)'
      );
      assert(
        unverifiedMapRes.data?.data?.centers?.[0]?.ineligibilityReasons?.some((r) =>
          r.includes('Food safety status is')
        ),
        'Reason states food safety verification is pending'
      );

      // E. Non-existent surplus ID returns 404
      const notFoundMapRes = await request('/api/matching/nearby/99999');
      assert(notFoundMapRes.statusCode === 404, 'Non-existent surplus ID returns HTTP 404');

      console.log(`\n📊 Security Review & Map Feature Test Summary: ${passed}/${total} checks passed.`);
      if (passed === total) {
        console.log('✨ Phase 3 Security Review & Map Feature are 100% Verified and Robust!\n');
      }
    } catch (err) {
      console.error('Review test execution error:', err);
    } finally {
      server.close(() => {
        console.log('Review test server closed cleanly.');
        process.exit(passed === total ? 0 : 1);
      });
    }
  });
}

runReviewTests();

