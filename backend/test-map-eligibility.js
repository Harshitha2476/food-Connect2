'use strict';
/**
 * test-map-eligibility.js
 * Phase 3 Audit – Map Eligibility Integration Tests
 *
 * Tests the GET /api/matching/nearby/:surplusId endpoint using a live Express
 * server started on an OS-assigned port (listen(0)).
 *
 * Each test scenario:
 *  1. Directly manipulates the SQLite database to put a surplus listing into
 *     the required state.
 *  2. Issues a real HTTP GET request to the running API.
 *  3. Asserts the returned isEligible flag and ineligibilityReasons.
 *  4. Restores the original listing state before the next scenario.
 *
 * Tests use the existing seeded canteen (canteenId 1) and distribution center
 * records so no new persistent records are created by this test file.
 */

const http = require('http');
const app = require('./server');
const { getDatabase } = require('./database/connection');

// ---------------------------------------------------------------------------
// HTTP helper (port-agnostic, bound after listen(0) resolves)
// ---------------------------------------------------------------------------
function makeRequest(port, urlPath, options = {}) {
  return new Promise((resolve, reject) => {
    const payload = options.body ? JSON.stringify(options.body) : null;
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    if (payload) headers['Content-Length'] = Buffer.byteLength(payload);

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
        res.on('data', (c) => (body += c));
        res.on('end', () => {
          try { resolve({ statusCode: res.statusCode, data: JSON.parse(body) }); }
          catch { resolve({ statusCode: res.statusCode, raw: body }); }
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// Test runner
// ---------------------------------------------------------------------------
async function runEligibilityTests() {
  console.log('\n🗺️  Starting Phase 3 Map Eligibility Tests...\n');

  const server = app.listen(0, async () => {
    const boundPort = server.address().port;
    const request = (urlPath, opts) => makeRequest(boundPort, urlPath, opts);

    let passed = 0;
    let total = 0;

    function assert(condition, name, detail = '') {
      total++;
      if (condition) {
        console.log(`  ✅ PASS: ${name}`);
        passed++;
      } else {
        console.error(`  ❌ FAIL: ${name}${detail ? ' — ' + detail : ''}`);
      }
    }

    // -----------------------------------------------------------------------
    // Prerequisite: find a seeded surplus listing that belongs to a canteen
    // that has valid GPS coordinates. We use canteen_id = 1 (Main Campus Canteen,
    // lat 12.9716 / lng 77.5946 from seed data). We will temporarily mutate
    // the same listing for each scenario.
    // -----------------------------------------------------------------------
    const db = getDatabase();

    // Find first listing owned by canteen 1 — use the third seeded listing
    // ("Steamed Rice", originally verified / available) so we don't interfere
    // with already-matched seed rows.
    const targetListing = db.prepare(`
      SELECT fsl.id, fsl.canteen_id, fsl.status, fsl.safety_status,
             fsl.available_quantity_kg, fsl.pickup_deadline
      FROM food_surplus_listings fsl
      WHERE fsl.canteen_id = 1
        AND fsl.status = 'available'
      LIMIT 1
    `).get();

    if (!targetListing) {
      console.error('  ⚠️  No suitable seed listing found in canteen 1 (available status). Cannot run eligibility tests.');
      server.close(() => process.exit(1));
      return;
    }

    const id = targetListing.id;
    console.log(`  ℹ️  Using surplus listing #${id} (canteen_id=1) as the test subject.\n`);

    // Helper: reset the listing to a clean verified/available/future-deadline state
    const tomorrowISO = new Date(Date.now() + 86400000).toISOString().slice(0, 16); // "YYYY-MM-DDTHH:MM"
    function resetListing() {
      db.prepare(`
        UPDATE food_surplus_listings
        SET status = 'available',
            matching_status = 'available',
            safety_status = 'verified',
            category = 'Rice',
            available_quantity_kg = 25,
            quantity_kg = 25,
            pickup_deadline = ?,
            updated_at = datetime('now')
        WHERE id = ?
      `).run(tomorrowISO, id);
    }

    // -----------------------------------------------------------------------
    // SCENARIO 1: Zero available quantity
    // -----------------------------------------------------------------------
    resetListing();
    db.prepare(`UPDATE food_surplus_listings SET available_quantity_kg = 0 WHERE id = ?`).run(id);
    {
      const res = await request(`/api/matching/nearby/${id}`);
      const centers = res.data?.data?.centers || [];
      const allIneligible = centers.length > 0 && centers.every((c) => !c.isEligible);
      const hasReason = centers.some((c) =>
        c.ineligibilityReasons.some((r) => r.includes('No available quantity'))
      );
      assert(res.statusCode === 200, 'Sc1: Zero qty — HTTP 200');
      assert(allIneligible, 'Sc1: Zero qty — all centers ineligible');
      assert(hasReason, 'Sc1: Zero qty — reason mentions "No available quantity"');
    }

    // -----------------------------------------------------------------------
    // SCENARIO 2: Fully allocated (status=matched, available_quantity_kg=0)
    // -----------------------------------------------------------------------
    resetListing();
    db.prepare(`
      UPDATE food_surplus_listings
      SET status = 'matched', available_quantity_kg = 0
      WHERE id = ?
    `).run(id);
    {
      const res = await request(`/api/matching/nearby/${id}`);
      const centers = res.data?.data?.centers || [];
      const allIneligible = centers.length > 0 && centers.every((c) => !c.isEligible);
      const hasQtyReason = centers.some((c) =>
        c.ineligibilityReasons.some((r) => r.includes('No available quantity') || r.includes('fully allocated'))
      );
      assert(res.statusCode === 200, 'Sc2: Fully allocated — HTTP 200');
      assert(allIneligible, 'Sc2: Fully allocated — all centers ineligible');
      assert(hasQtyReason, 'Sc2: Fully allocated — reason present for zero qty or fully allocated');
    }

    // -----------------------------------------------------------------------
    // SCENARIO 3: Cancelled listing
    // -----------------------------------------------------------------------
    resetListing();
    db.prepare(`
      UPDATE food_surplus_listings
      SET status = 'cancelled', matching_status = 'cancelled', available_quantity_kg = 0
      WHERE id = ?
    `).run(id);
    {
      const res = await request(`/api/matching/nearby/${id}`);
      const centers = res.data?.data?.centers || [];
      const allIneligible = centers.length > 0 && centers.every((c) => !c.isEligible);
      const hasReason = centers.some((c) =>
        c.ineligibilityReasons.some((r) => r.toLowerCase().includes('cancelled'))
      );
      assert(res.statusCode === 200, 'Sc3: Cancelled — HTTP 200');
      assert(allIneligible, 'Sc3: Cancelled — all centers ineligible');
      assert(hasReason, 'Sc3: Cancelled — reason mentions "cancelled"');
    }

    // -----------------------------------------------------------------------
    // SCENARIO 4: Expired listing
    // -----------------------------------------------------------------------
    resetListing();
    db.prepare(`UPDATE food_surplus_listings SET status = 'expired' WHERE id = ?`).run(id);
    {
      const res = await request(`/api/matching/nearby/${id}`);
      const centers = res.data?.data?.centers || [];
      const allIneligible = centers.length > 0 && centers.every((c) => !c.isEligible);
      const hasReason = centers.some((c) =>
        c.ineligibilityReasons.some((r) => r.toLowerCase().includes('expired'))
      );
      assert(res.statusCode === 200, 'Sc4: Expired — HTTP 200');
      assert(allIneligible, 'Sc4: Expired — all centers ineligible');
      assert(hasReason, 'Sc4: Expired — reason mentions "expired"');
    }

    // -----------------------------------------------------------------------
    // SCENARIO 5: Food safety pending
    // -----------------------------------------------------------------------
    resetListing();
    db.prepare(`UPDATE food_surplus_listings SET safety_status = 'pending' WHERE id = ?`).run(id);
    {
      const res = await request(`/api/matching/nearby/${id}`);
      const centers = res.data?.data?.centers || [];
      const allIneligible = centers.length > 0 && centers.every((c) => !c.isEligible);
      const hasReason = centers.some((c) =>
        c.ineligibilityReasons.some((r) => r.includes("Food safety status is 'pending'") || r.includes('pending'))
      );
      assert(res.statusCode === 200, 'Sc5: Safety pending — HTTP 200');
      assert(allIneligible, 'Sc5: Safety pending — all centers ineligible');
      assert(hasReason, 'Sc5: Safety pending — reason mentions "pending"');
    }

    // -----------------------------------------------------------------------
    // SCENARIO 6: Food safety rejected
    // -----------------------------------------------------------------------
    resetListing();
    db.prepare(`UPDATE food_surplus_listings SET safety_status = 'rejected' WHERE id = ?`).run(id);
    {
      const res = await request(`/api/matching/nearby/${id}`);
      const centers = res.data?.data?.centers || [];
      const allIneligible = centers.length > 0 && centers.every((c) => !c.isEligible);
      const hasReason = centers.some((c) =>
        c.ineligibilityReasons.some((r) => r.includes("Food safety status is 'rejected'") || r.includes('rejected'))
      );
      assert(res.statusCode === 200, 'Sc6: Safety rejected — HTTP 200');
      assert(allIneligible, 'Sc6: Safety rejected — all centers ineligible');
      assert(hasReason, 'Sc6: Safety rejected — reason mentions "rejected"');
    }

    // -----------------------------------------------------------------------
    // SCENARIO 7: Pickup deadline already passed
    // -----------------------------------------------------------------------
    resetListing();
    const pastDeadline = new Date(Date.now() - 3600000).toISOString().slice(0, 16); // 1 hour ago
    db.prepare(`UPDATE food_surplus_listings SET pickup_deadline = ? WHERE id = ?`).run(pastDeadline, id);
    {
      const res = await request(`/api/matching/nearby/${id}`);
      const centers = res.data?.data?.centers || [];
      const allIneligible = centers.length > 0 && centers.every((c) => !c.isEligible);
      const hasReason = centers.some((c) =>
        c.ineligibilityReasons.some((r) => r.toLowerCase().includes('deadline') || r.toLowerCase().includes('passed'))
      );
      assert(res.statusCode === 200, 'Sc7: Past deadline — HTTP 200');
      assert(allIneligible, 'Sc7: Past deadline — all centers ineligible');
      assert(hasReason, 'Sc7: Past deadline — reason mentions "deadline" or "passed"');
    }

    // -----------------------------------------------------------------------
    // SCENARIO 8: Distance fields present and correctly labelled
    // This also verifies routing is clearly simulated.
    // -----------------------------------------------------------------------
    resetListing();
    {
      const res = await request(`/api/matching/nearby/${id}`);
      const centers = res.data?.data?.centers || [];
      const meta = res.data?.data?.routingMetadata || {};
      const hasDistanceFields = centers.length > 0 && centers.every((c) =>
        typeof c.straightLineDistanceKm === 'number' &&
        typeof c.estimatedRoadDistanceKm === 'number' &&
        typeof c.estimatedTravelTimeMin === 'number' &&
        typeof c.routingStatus === 'string' &&
        typeof c.isLiveRouting === 'boolean' &&
        typeof c.routingProvider === 'string'
      );
      assert(res.statusCode === 200, 'Sc8: Distance fields — HTTP 200');
      assert(hasDistanceFields, 'Sc8: Distance fields — all distance/routing fields present on each center');
      assert(meta.isLiveRouting === false, 'Sc8: Routing metadata — isLiveRouting is false (simulated)');
      // straightLine must be <= estimatedRoad (road is longer or equal due to winding factor)
      const roadGeReason = centers.every((c) => c.estimatedRoadDistanceKm >= c.straightLineDistanceKm);
      assert(roadGeReason, 'Sc8: Distance fields — estimatedRoadDistanceKm >= straightLineDistanceKm for all centers');
    }

    // -----------------------------------------------------------------------
    // SCENARIO 8B: Travel time greater than 15 minutes
    // -----------------------------------------------------------------------
    resetListing();
    // Center 2 (Community Food Bank, normal travel time 12 min) set to 25 min
    db.prepare(`UPDATE distribution_centers SET travel_time_min = 25 WHERE id = 2`).run();
    {
      const res = await request(`/api/matching/nearby/${id}`);
      const centers = res.data?.data?.centers || [];
      const center2 = centers.find((c) => c.centerId === 2);
      assert(res.statusCode === 200, 'Sc8B: Travel time > 15 min — HTTP 200');
      assert(center2 && center2.isEligible === false, 'Sc8B: Center with travel time > 15 min is ineligible');
      assert(
        center2 && center2.ineligibilityReasons.some((r) => r.includes('exceeds the maximum 15-minute transit window')),
        'Sc8B: Reason notes exceeding maximum 15-minute transit window'
      );
    }
    // Restore Center 2 travel time to 12
    db.prepare(`UPDATE distribution_centers SET travel_time_min = 12 WHERE id = 2`).run();

    // -----------------------------------------------------------------------
    // SCENARIO 9: Center with zero available capacity
    // Set all centers' available_capacity_kg to 0 temporarily, verify reason
    // -----------------------------------------------------------------------
    resetListing();
    db.prepare(`UPDATE distribution_centers SET available_capacity_kg = 0`).run();
    {
      const res = await request(`/api/matching/nearby/${id}`);
      const centers = res.data?.data?.centers || [];
      const allHaveCapacityReason = centers.every((c) =>
        c.ineligibilityReasons.some((r) => r.includes('0 kg available storage capacity'))
      );
      assert(res.statusCode === 200, 'Sc9: Zero capacity — HTTP 200');
      assert(allHaveCapacityReason, 'Sc9: Zero capacity — all centers report capacity reason');
    }
    // Restore capacity from seed values
    db.prepare(`UPDATE distribution_centers SET available_capacity_kg = 85 WHERE id = 1`).run();
    db.prepare(`UPDATE distribution_centers SET available_capacity_kg = 140 WHERE id = 2`).run();
    db.prepare(`UPDATE distribution_centers SET available_capacity_kg = 55 WHERE id = 3`).run();
    // For any extra centers beyond the first 3, re-sync via model
    const extraCenters = db.prepare(`SELECT id, capacity_kg FROM distribution_centers WHERE id > 3`).all();
    for (const ec of extraCenters) {
      db.prepare(`UPDATE distribution_centers SET available_capacity_kg = capacity_kg WHERE id = ?`).run(ec.id);
    }

    // -----------------------------------------------------------------------
    // SCENARIO 10: Incompatible food category
    // Set listing category to something no center accepts; also set all center
    // demand categories explicitly.
    // -----------------------------------------------------------------------
    resetListing();
    // 'Bakery' is a valid SQLite category in ('Cooked Meals', 'Rice', 'Vegetables', 'Fruits', 'Bakery', 'Other')
    db.prepare(`UPDATE food_surplus_listings SET category = 'Bakery' WHERE id = ?`).run(id);
    // Ensure all centers have an explicit demand list that excludes Bakery (and does not include 'Other')
    db.prepare(`UPDATE food_demand SET categories = ?`).run(JSON.stringify(['Cooked Meals', 'Rice']));
    {
      const res = await request(`/api/matching/nearby/${id}`);
      const centers = res.data?.data?.centers || [];
      // Some centers may still have empty demand (which skips category check), so we
      // only check centers that have demand categories listed.
      const centersWithDemand = centers.filter((c) => c.demand?.categories?.length > 0);
      const allRejectedByCategory = centersWithDemand.length > 0 &&
        centersWithDemand.every((c) =>
          c.ineligibilityReasons.some((r) => r.includes("does not accept") && r.includes('Bakery'))
        );
      assert(res.statusCode === 200, 'Sc10: Category mismatch — HTTP 200');
      assert(allRejectedByCategory, 'Sc10: Category mismatch — centers with demand reject Bakery');
    }
    // Restore category
    db.prepare(`UPDATE food_surplus_listings SET category = 'Rice' WHERE id = ?`).run(id);
    // Restore demand categories
    db.prepare(`UPDATE food_demand SET categories = ? WHERE center_id = 1`).run(JSON.stringify(['Cooked Meals', 'Rice', 'Vegetables']));
    db.prepare(`UPDATE food_demand SET categories = ? WHERE center_id = 2`).run(JSON.stringify(['Fruits', 'Bakery', 'Vegetables']));
    db.prepare(`UPDATE food_demand SET categories = ? WHERE center_id = 3`).run(JSON.stringify(['Cooked Meals', 'Rice', 'Bakery']));
    db.prepare(`UPDATE food_demand SET categories = ? WHERE center_id > 3`).run(JSON.stringify(['Cooked Meals', 'Rice', 'Vegetables']));

    // -----------------------------------------------------------------------
    // SCENARIO 11: Valid surplus — at least one eligible center
    // All conditions clear: verified, available, future deadline, with quantity.
    // -----------------------------------------------------------------------
    resetListing();
    // Also restore the first center with generous capacity and matching demand
    db.prepare(`UPDATE distribution_centers SET available_capacity_kg = 85 WHERE id = 1`).run();
    db.prepare(`UPDATE food_demand SET categories = '["Cooked Meals","Rice","Vegetables"]' WHERE center_id = 1`).run();
    {
      const res = await request(`/api/matching/nearby/${id}`);
      const centers = res.data?.data?.centers || [];
      const eligible = centers.filter((c) => c.isEligible);
      assert(res.statusCode === 200, 'Sc11: Valid surplus — HTTP 200');
      assert(eligible.length > 0, `Sc11: Valid surplus — at least one eligible center (found ${eligible.length})`);
      if (eligible.length > 0) {
        assert(eligible[0].ineligibilityReasons.length === 0, 'Sc11: Valid center — ineligibilityReasons is empty');
      }
    }

    // -----------------------------------------------------------------------
    // Final reset — restore listing and database to clean seed state
    // -----------------------------------------------------------------------
    resetListing();
    db.prepare(`UPDATE distribution_centers SET available_capacity_kg = 85 WHERE id = 1`).run();
    db.prepare(`UPDATE distribution_centers SET available_capacity_kg = 140 WHERE id = 2`).run();
    db.prepare(`UPDATE distribution_centers SET available_capacity_kg = 55 WHERE id = 3`).run();
    db.prepare(`UPDATE distribution_centers SET travel_time_min = 8 WHERE id = 1`).run();
    db.prepare(`UPDATE distribution_centers SET travel_time_min = 12 WHERE id = 2`).run();
    db.prepare(`UPDATE distribution_centers SET travel_time_min = 10 WHERE id = 3`).run();
    db.prepare(`UPDATE food_demand SET categories = ? WHERE center_id = 1`).run(JSON.stringify(['Cooked Meals', 'Rice', 'Vegetables']));
    db.prepare(`UPDATE food_demand SET categories = ? WHERE center_id = 2`).run(JSON.stringify(['Fruits', 'Bakery', 'Vegetables']));
    db.prepare(`UPDATE food_demand SET categories = ? WHERE center_id = 3`).run(JSON.stringify(['Cooked Meals', 'Rice', 'Bakery']));
    db.prepare(`UPDATE food_demand SET categories = ? WHERE center_id > 3`).run(JSON.stringify(['Cooked Meals', 'Rice', 'Vegetables']));

    // Summary
    console.log(`\n📊 Map Eligibility Test Summary: ${passed}/${total} checks passed.`);
    if (passed === total) {
      console.log('✨ All map eligibility scenarios passed!\n');
    } else {
      console.log(`⚠️  ${total - passed} check(s) failed.\n`);
    }

    server.close(() => {
      console.log('Map eligibility test server closed cleanly.');
      process.exit(passed === total ? 0 : 1);
    });
  });

  server.on('error', (err) => {
    console.error('Map eligibility test server failed to start:', err.message);
    process.exit(1);
  });
}

runEligibilityTests();
