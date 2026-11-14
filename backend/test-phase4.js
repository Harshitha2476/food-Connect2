'use strict';
/**
 * test-phase4.js
 * Comprehensive Integration Tests for Phase 4:
 * Intelligent Food Matching, Multi-Criteria Scoring, Greedy Allocation,
 * Offer Acceptance/Rejection, and Fallback Workflows.
 */

const http = require('http');
const app = require('./server');
const { getDatabase } = require('./database/connection');
const CenterModel = require('./models/Center');

// Dynamic port helper (port 0 assigned by OS)
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
    if (payload) req.write(payload);
    req.end();
  });
}

async function runPhase4Tests() {
  console.log('\n🤖 Starting Phase 4 Intelligent Matching & Allocation Tests...\n');

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

    const db = getDatabase();

    // Clean up test data from any previous runs
    db.prepare('DELETE FROM matching_allocations WHERE id > 2').run();
    db.prepare('DELETE FROM food_surplus_listings WHERE id > 22').run();

    const otherCenterIds = db.prepare('SELECT id FROM distribution_centers WHERE id > 3').all();
    function restoreSeedCapacities() {
      db.prepare('UPDATE distribution_centers SET capacity_kg = 120, available_capacity_kg = 92, travel_time_min = 8, is_verified = 1 WHERE id = 1').run();
      db.prepare('UPDATE distribution_centers SET capacity_kg = 200, available_capacity_kg = 200, travel_time_min = 12, is_verified = 1 WHERE id = 2').run();
      db.prepare('UPDATE distribution_centers SET capacity_kg = 90, available_capacity_kg = 46, travel_time_min = 10, is_verified = 1 WHERE id = 3').run();
      db.prepare(`UPDATE food_demand SET categories = ? WHERE center_id = 1`).run(JSON.stringify(['Cooked Meals', 'Rice', 'Vegetables']));
      db.prepare(`UPDATE food_demand SET categories = ? WHERE center_id = 2`).run(JSON.stringify(['Fruits', 'Bakery', 'Vegetables']));
      for (const oc of otherCenterIds) {
        db.prepare('UPDATE distribution_centers SET capacity_kg = 150, available_capacity_kg = 150, travel_time_min = 10, is_verified = 1 WHERE id = ?').run(oc.id);
      }
      CenterModel.syncAvailableCapacity(1);
      CenterModel.syncAvailableCapacity(2);
      CenterModel.syncAvailableCapacity(3);
      for (const oc of otherCenterIds) {
        CenterModel.syncAvailableCapacity(oc.id);
      }
    }

    restoreSeedCapacities();

    try {
      // -------------------------------------------------------------
      // 0. Setup: Obtain tokens for all roles
      // -------------------------------------------------------------
      const loginCanteen = await request('/api/auth/login', {
        method: 'POST',
        body: { email: 'canteen@campus.edu', password: 'canteen123' }, // Canteen 1
      });
      const canteenToken = loginCanteen.data?.data?.token;

      const loginCanteen2 = await request('/api/auth/login', {
        method: 'POST',
        body: { email: 'engg.mess@campus.edu', password: 'canteen123' }, // Canteen 2
      });
      const canteen2Token = loginCanteen2.data?.data?.token;

      const loginNgo1 = await request('/api/auth/login', {
        method: 'POST',
        body: { email: 'ngo@hopekitchen.org', password: 'ngo123' }, // Center 1 (Hope Kitchen)
      });
      const ngo1Token = loginNgo1.data?.data?.token;

      const loginNgo2 = await request('/api/auth/login', {
        method: 'POST',
        body: { email: 'sunita@communityfoodbank.org', password: 'ngo123' }, // Center 2 (Community Food Bank)
      });
      const ngo2Token = loginNgo2.data?.data?.token;

      const loginVol = await request('/api/auth/login', {
        method: 'POST',
        body: { email: 'volunteer@campus.edu', password: 'volunteer123' },
      });
      const volToken = loginVol.data?.data?.token;

      const loginSafety = await request('/api/auth/login', {
        method: 'POST',
        body: { email: 'safety@campus.edu', password: 'safety123' },
      });
      const safetyToken = loginSafety.data?.data?.token;

      const loginAdmin = await request('/api/auth/login', {
        method: 'POST',
        body: { email: 'admin@campus.edu', password: 'admin123' },
      });
      const adminToken = loginAdmin.data?.data?.token;

      assert(canteenToken && ngo1Token && ngo2Token && adminToken, 'Obtained auth tokens for canteen, NGOs, and admin');

      // Helper to create a verified surplus listing for testing
      const today = new Date().toISOString().slice(0, 10);
      async function createVerifiedSurplus(qty = 20, category = 'Cooked Meals', canteenTkn = canteenToken) {
        const createRes = await request('/api/surplus', {
          method: 'POST',
          headers: { Authorization: `Bearer ${canteenTkn}` },
          body: {
            foodName: `Test Meal ${Date.now()}`,
            category,
            quantityKg: qty,
            preparationDate: today,
            preparationTime: '11:00',
            storageMethod: 'Hot holding',
            storageTemp: '68°C',
            ingredients: 'Rice, lentils, vegetables, spices',
            allergens: 'None',
            pickupDeadline: '18:00',
            location: 'Main Canteen Ground Floor',
          },
        });
        const surplusId = createRes.data?.data?.surplus?.id;

        // Verify safety as Safety Officer
        await request(`/api/surplus/${surplusId}/safety`, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${safetyToken}` },
          body: { safetyStatus: 'verified', notes: 'Food safety verified for matching tests' },
        });

        return surplusId;
      }

      // -------------------------------------------------------------
      // 1. SCENARIO 3 & 4: Multi-criteria matching score calculation and ranking
      // -------------------------------------------------------------
      const surplusForRanking = await createVerifiedSurplus(15, 'Cooked Meals');

      const rankingRes = await request(`/api/matching/rankings/${surplusForRanking}`, {
        headers: { Authorization: `Bearer ${canteenToken}` },
      });

      assert(rankingRes.statusCode === 200, 'Sc3/4: GET /api/matching/rankings/:id returns HTTP 200');
      assert(rankingRes.data?.success === true, 'Sc3/4: Rankings API returns success: true');
      const rankedEligible = rankingRes.data?.data?.eligibleCenters || [];
      assert(rankedEligible.length > 0, 'Sc3/4: Eligible centers identified in rankings');

      if (rankedEligible.length > 0) {
        const first = rankedEligible[0];
        assert(typeof first.matchScore === 'number' && first.matchScore >= 0 && first.matchScore <= 100, 'Sc3: Match score is bounded 0-100');
        assert(first.scores?.demand !== undefined && first.scores?.capacity !== undefined, 'Sc3: Score breakdown includes demand and capacity components');
        assert(first.scores?.travel !== undefined && first.scores?.urgency !== undefined, 'Sc3: Score breakdown includes travel and urgency components');

        // Verify ranking order (descending scores)
        let isSorted = true;
        for (let i = 0; i < rankedEligible.length - 1; i++) {
          if (rankedEligible[i].matchScore < rankedEligible[i + 1].matchScore) {
            isSorted = false;
            break;
          }
        }
        assert(isSorted, 'Sc4: Eligible centers are ranked in descending match score order');
      }

      // -------------------------------------------------------------
      // 2. SCENARIO 5: Center with travel time > 15 minutes is excluded
      // -------------------------------------------------------------
      // Temporarily set Center 3 travel time to 25 min
      db.prepare(`UPDATE distribution_centers SET travel_time_min = 25 WHERE id = 3`).run();
      const rankingExclusionRes = await request(`/api/matching/rankings/${surplusForRanking}`, {
        headers: { Authorization: `Bearer ${canteenToken}` },
      });
      const ineligibles = rankingExclusionRes.data?.data?.ineligibleCenters || [];
      const distantCenter = ineligibles.find((c) => c.centerId === 3);
      assert(!!distantCenter, 'Sc5: Center with travel time > 15 min excluded from eligible ranking');
      assert(
        distantCenter?.ineligibilityReasons?.some((r) => r.includes('15-minute transit window')),
        'Sc5: Exclusion reason clearly states 15-minute transit window exceeded'
      );
      // Restore Center 3 travel time
      db.prepare(`UPDATE distribution_centers SET travel_time_min = 10 WHERE id = 3`).run();

      // -------------------------------------------------------------
      // 3. SCENARIO 6: Center with zero capacity is excluded
      // -------------------------------------------------------------
      db.prepare(`UPDATE distribution_centers SET capacity_kg = 0, available_capacity_kg = 0 WHERE id = 2`).run();
      const rankingZeroCapRes = await request(`/api/matching/rankings/${surplusForRanking}`, {
        headers: { Authorization: `Bearer ${canteenToken}` },
      });
      const zeroCapCenter = (rankingZeroCapRes.data?.data?.ineligibleCenters || []).find((c) => c.centerId === 2);
      assert(!!zeroCapCenter, 'Sc6: Center with 0 kg capacity excluded from eligible ranking');
      assert(
        zeroCapCenter?.ineligibilityReasons?.some((r) => r.includes('0 kg available storage capacity')),
        'Sc6: Exclusion reason clearly cites 0 kg capacity'
      );
      restoreSeedCapacities();

      // -------------------------------------------------------------
      // 4. SCENARIO 7: Category mismatch is excluded
      // -------------------------------------------------------------
      const bakerySurplusId = await createVerifiedSurplus(10, 'Bakery');
      // Set Center 1 demand explicitly to Cooked Meals only (excludes Bakery)
      db.prepare(`UPDATE food_demand SET categories = ? WHERE center_id = 1`).run(JSON.stringify(['Cooked Meals']));
      const rankingCategoryRes = await request(`/api/matching/rankings/${bakerySurplusId}`, {
        headers: { Authorization: `Bearer ${canteenToken}` },
      });
      const catMismatched = (rankingCategoryRes.data?.data?.ineligibleCenters || []).find((c) => c.centerId === 1);
      assert(!!catMismatched, 'Sc7: Center rejecting food category excluded from matching');
      assert(
        catMismatched?.ineligibilityReasons?.some((r) => r.includes("does not accept 'Bakery'")),
        'Sc7: Reason explicitly states center does not accept category'
      );
      db.prepare(`UPDATE food_demand SET categories = ? WHERE center_id = 1`).run(JSON.stringify(['Cooked Meals', 'Rice', 'Vegetables']));

      // -------------------------------------------------------------
      // 5. SCENARIO 8: Inactive center is excluded
      // -------------------------------------------------------------
      db.prepare(`UPDATE distribution_centers SET is_verified = 0 WHERE id = 3`).run();
      const rankingInactiveRes = await request(`/api/matching/rankings/${surplusForRanking}`, {
        headers: { Authorization: `Bearer ${canteenToken}` },
      });
      const inactiveCenter = (rankingInactiveRes.data?.data?.ineligibleCenters || []).find((c) => c.centerId === 3);
      assert(!!inactiveCenter, 'Sc8: Inactive center is excluded from eligible ranking');
      assert(
        inactiveCenter?.ineligibilityReasons?.some((r) => r.includes('inactive or unverified')),
        'Sc8: Reason indicates center is inactive or unverified'
      );
      db.prepare(`UPDATE distribution_centers SET is_verified = 1 WHERE id = 3`).run();

      // -------------------------------------------------------------
      // 6. SCENARIO 9, 10, 11, 12, 13: Ineligible surplus statuses reject trigger
      // -------------------------------------------------------------
      // Sc9: Pending safety
      const pendingSurplusRes = await request('/api/surplus', {
        method: 'POST',
        headers: { Authorization: `Bearer ${canteenToken}` },
        body: {
          foodName: 'Pending Soup',
          category: 'Cooked Meals',
          quantityKg: 10,
          preparationDate: today,
          preparationTime: '12:00',
          storageMethod: 'Hot holding',
          storageTemp: '65°C',
          ingredients: 'Tomato, water',
          allergens: 'None',
          pickupDeadline: '17:00',
          location: 'Block A',
        },
      });
      const pendingSurplusId = pendingSurplusRes.data?.data?.surplus?.id;
      const triggerPendingRes = await request(`/api/matching/trigger/${pendingSurplusId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${canteenToken}` },
      });
      assert(triggerPendingRes.statusCode === 400, 'Sc9: Trigger matching on safety pending rejected (HTTP 400)');
      assert(triggerPendingRes.data?.message?.includes('pending'), 'Sc9: Error mentions food safety pending');

      // Sc10: Rejected safety
      await request(`/api/surplus/${pendingSurplusId}/safety`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${safetyToken}` },
        body: { safetyStatus: 'rejected', notes: 'Contamination detected' },
      });
      const triggerRejectedRes = await request(`/api/matching/trigger/${pendingSurplusId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${canteenToken}` },
      });
      assert(triggerRejectedRes.statusCode === 400, 'Sc10: Trigger matching on safety rejected food blocked (HTTP 400)');

      // Sc11: Expired surplus
      const expiredSurplusId = await createVerifiedSurplus(10, 'Rice');
      db.prepare(`UPDATE food_surplus_listings SET status = 'expired' WHERE id = ?`).run(expiredSurplusId);
      const triggerExpiredRes = await request(`/api/matching/trigger/${expiredSurplusId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${canteenToken}` },
      });
      assert(triggerExpiredRes.statusCode === 400, 'Sc11: Trigger matching on expired surplus blocked (HTTP 400)');

      // Sc12: Cancelled surplus
      const cancelledSurplusId = await createVerifiedSurplus(10, 'Rice');
      db.prepare(`UPDATE food_surplus_listings SET status = 'cancelled' WHERE id = ?`).run(cancelledSurplusId);
      const triggerCancelledRes = await request(`/api/matching/trigger/${cancelledSurplusId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${canteenToken}` },
      });
      assert(triggerCancelledRes.statusCode === 400, 'Sc12: Trigger matching on cancelled surplus blocked (HTTP 400)');

      // Sc13: Zero available quantity
      const zeroQtySurplusId = await createVerifiedSurplus(10, 'Rice');
      db.prepare(`UPDATE food_surplus_listings SET available_quantity_kg = 0 WHERE id = ?`).run(zeroQtySurplusId);
      const triggerZeroQtyRes = await request(`/api/matching/trigger/${zeroQtySurplusId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${canteenToken}` },
      });
      assert(triggerZeroQtyRes.statusCode === 400, 'Sc13: Trigger matching on zero available quantity blocked (HTTP 400)');

      // -------------------------------------------------------------
      // 7. SCENARIO 1: Valid surplus with one eligible center
      // -------------------------------------------------------------
      const singleEligibleSurplus = await createVerifiedSurplus(15, 'Cooked Meals');
      // Set travel time > 15 min on all centers except Center 1
      db.prepare(`UPDATE distribution_centers SET travel_time_min = 25 WHERE id != 1`).run();

      const triggerSingleRes = await request(`/api/matching/trigger/${singleEligibleSurplus}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${canteenToken}` },
      });
      assert(triggerSingleRes.statusCode === 200, 'Sc1: Trigger matching with 1 eligible center succeeds (HTTP 200)');
      assert(triggerSingleRes.data?.data?.allocations?.length === 1, 'Sc1: Exactly 1 allocation created');
      assert(triggerSingleRes.data?.data?.allocations[0]?.centerId === 1, 'Sc1: Allocation assigned to the single eligible center');

      // Restore seed capacities and travel times
      restoreSeedCapacities();

      // -------------------------------------------------------------
      // 8. SCENARIO 2, 14, 15, 16: Partial allocation across multiple centers & capacity bounds
      // -------------------------------------------------------------
      // Clean up previous test allocations so Center 1 has only seed commitment (28 kg)
      db.prepare('DELETE FROM matching_allocations WHERE id > 2').run();
      // Surplus has 50 kg.
      // Set Center 1 available capacity = 30 kg (capacity 58 - 28 committed = 30).
      // Set Center 2 available capacity = 30 kg (capacity 30 - 0 committed = 30).
      // Make all other centers travel time > 15 min.
      // Ensure Center 2 accepts Cooked Meals for this test
      db.prepare(`UPDATE food_demand SET categories = ? WHERE center_id = 2`).run(
        JSON.stringify(['Fruits', 'Bakery', 'Vegetables', 'Cooked Meals'])
      );
      const multiCenterSurplus = await createVerifiedSurplus(50, 'Cooked Meals');
      db.prepare(`UPDATE distribution_centers SET capacity_kg = 58, available_capacity_kg = 30 WHERE id = 1`).run();
      db.prepare(`UPDATE distribution_centers SET capacity_kg = 30, available_capacity_kg = 30 WHERE id = 2`).run();
      db.prepare(`UPDATE distribution_centers SET travel_time_min = 25 WHERE id NOT IN (1, 2)`).run();
      CenterModel.syncAvailableCapacity(1);
      CenterModel.syncAvailableCapacity(2);

      const triggerMultiRes = await request(`/api/matching/trigger/${multiCenterSurplus}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${canteenToken}` },
      });
      assert(triggerMultiRes.statusCode === 200, 'Sc2/14: Trigger matching with multi-center allocation returns HTTP 200');
      const multiAllocs = triggerMultiRes.data?.data?.allocations || [];
      assert(multiAllocs.length === 2, 'Sc14: Partial allocation partitioned across 2 centers');

      const totalAllocated = multiAllocs.reduce((sum, a) => sum + a.allocatedKg, 0);
      assert(totalAllocated === 50, 'Sc15: Total allocated quantity equals surplus quantity (50 kg)');
      assert(triggerMultiRes.data?.data?.remainingAvailableKg === 0, 'Sc15: Remaining surplus quantity is 0 kg');

      // Check center capacity limits
      assert(multiAllocs[0]?.allocatedKg <= 30, 'Sc16: Center 1 allocation does not exceed center capacity (30 kg)');
      assert(multiAllocs[1]?.allocatedKg <= 30, 'Sc16: Center 2 allocation does not exceed center capacity (30 kg)');

      // Verify surplus status updated to 'matched'
      const updatedMultiSurplus = db.prepare('SELECT status, available_quantity_kg FROM food_surplus_listings WHERE id = ?').get(multiCenterSurplus);
      assert(updatedMultiSurplus.status === 'matched', 'Sc15: Fully allocated surplus status set to "matched"');
      assert(updatedMultiSurplus.available_quantity_kg === 0, 'Sc15: Fully allocated surplus available_quantity_kg is 0');

      restoreSeedCapacities();

      // -------------------------------------------------------------
      // 9. SCENARIO 17: Acceptance updates the correct records
      // -------------------------------------------------------------
      const acceptSurplusId = await createVerifiedSurplus(18, 'Cooked Meals');
      const triggerAcceptRes = await request(`/api/matching/trigger/${acceptSurplusId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${canteenToken}` },
      });
      const allocToAccept = triggerAcceptRes.data?.data?.allocations?.[0];
      assert(!!allocToAccept, 'Sc17: Created allocation offer for acceptance test');

      // Center 1's NGO accepts offer
      const acceptToken = allocToAccept.centerId === 1 ? ngo1Token : (allocToAccept.centerId === 2 ? ngo2Token : adminToken);
      const acceptRes = await request(`/api/matching/offers/${allocToAccept.allocationId}/accept`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${acceptToken}` },
      });
      assert(acceptRes.statusCode === 200, 'Sc17: Accept offer returns HTTP 200');
      assert(acceptRes.data?.data?.allocation?.status === 'accepted', 'Sc17: Allocation status updated to "accepted"');
      assert(!!acceptRes.data?.data?.allocation?.respondedAt, 'Sc17: Responded timestamp recorded on acceptance');

      // Repeated acceptance rejected
      const repeatAcceptRes = await request(`/api/matching/offers/${allocToAccept.allocationId}/accept`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${acceptToken}` },
      });
      assert(repeatAcceptRes.statusCode === 400, 'Sc17: Repeated acceptance blocked with HTTP 400');

      // -------------------------------------------------------------
      // 10. SCENARIO 18 & 19: Rejection requires reason & triggers fallback matching
      // -------------------------------------------------------------
      const rejectSurplusId = await createVerifiedSurplus(22, 'Cooked Meals');
      const triggerRejectRes = await request(`/api/matching/trigger/${rejectSurplusId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${canteenToken}` },
      });
      const allocToReject = triggerRejectRes.data?.data?.allocations?.[0];
      assert(!!allocToReject, 'Sc18/19: Created allocation offer for rejection test');

      const rejectToken = allocToReject.centerId === 1 ? ngo1Token : (allocToReject.centerId === 2 ? ngo2Token : adminToken);

      // Attempt rejection without reason
      const emptyReasonRes = await request(`/api/matching/offers/${allocToReject.allocationId}/reject`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${rejectToken}` },
        body: { rejectionReason: '' },
      });
      assert(emptyReasonRes.statusCode === 400, 'Sc18: Rejection without reason rejected (HTTP 400)');

      // Valid rejection with explanatory reason
      const validRejectRes = await request(`/api/matching/offers/${allocToReject.allocationId}/reject`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${rejectToken}` },
        body: { rejectionReason: 'Kitchen refrigerator maintenance in progress' },
      });
      assert(validRejectRes.statusCode === 200, 'Sc19: Rejection with reason returns HTTP 200');
      assert(validRejectRes.data?.data?.rejectionReason === 'Kitchen refrigerator maintenance in progress', 'Sc18: Rejection reason recorded');

      // Verify capacity was released and fallback was evaluated
      const rejectedRow = db.prepare('SELECT status, rejection_reason FROM matching_allocations WHERE id = ?').get(allocToReject.allocationId);
      assert(rejectedRow.status === 'rejected', 'Sc19: Allocation record status is "rejected"');

      const fallbackResult = validRejectRes.data?.data?.fallbackMatching;
      assert(fallbackResult !== undefined, 'Sc19: Fallback matching evaluated after rejection');

      // Repeated rejection rejected
      const repeatRejectRes = await request(`/api/matching/offers/${allocToReject.allocationId}/reject`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${rejectToken}` },
        body: { rejectionReason: 'Second decline' },
      });
      assert(repeatRejectRes.statusCode === 400, 'Sc19: Repeated rejection blocked with HTTP 400');

      // -------------------------------------------------------------
      // 11. SCENARIO 20: Expired offer triggers fallback matching
      // -------------------------------------------------------------
      const expireSurplusId = await createVerifiedSurplus(16, 'Cooked Meals');
      const triggerExpireRes = await request(`/api/matching/trigger/${expireSurplusId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${canteenToken}` },
      });
      const allocToExpire = triggerExpireRes.data?.data?.allocations?.[0];
      assert(!!allocToExpire, 'Sc20: Created allocation offer for expiration test');

      // Manually age the offer offered_at time back 30 minutes
      db.prepare(`
        UPDATE matching_allocations
        SET offered_at = datetime('now', '-30 minutes')
        WHERE id = ?
      `).run(allocToExpire.allocationId);

      // Process expired offers (threshold 15 minutes)
      const processExpiredRes = await request('/api/matching/process-expired', {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
        body: { timeoutMinutes: 15 },
      });
      assert(processExpiredRes.statusCode === 200, 'Sc20: Process expired offers returns HTTP 200');
      assert(processExpiredRes.data?.data?.processedCount >= 1, 'Sc20: At least 1 expired offer processed');

      const expiredRecord = db.prepare('SELECT status FROM matching_allocations WHERE id = ?').get(allocToExpire.allocationId);
      assert(expiredRecord.status === 'expired', 'Sc20: Timed-out offer status updated to "expired"');

      // -------------------------------------------------------------
      // 12. SCENARIO 21: No eligible center produces a clear result
      // -------------------------------------------------------------
      const noEligibleSurplus = await createVerifiedSurplus(25, 'Cooked Meals');
      // Set all centers' travel time > 15 min
      db.prepare(`UPDATE distribution_centers SET travel_time_min = 25`).run();
      const triggerNoEligibleRes = await request(`/api/matching/trigger/${noEligibleSurplus}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${canteenToken}` },
      });
      assert(triggerNoEligibleRes.statusCode === 200, 'Sc21: No eligible centers returns HTTP 200 with clear message');
      assert(triggerNoEligibleRes.data?.data?.allocationStatus === 'no_eligible_centers', 'Sc21: Status indicates no_eligible_centers');
      assert(triggerNoEligibleRes.data?.data?.allocations?.length === 0, 'Sc21: Zero allocations created');

      restoreSeedCapacities();

      // -------------------------------------------------------------
      // 13. SCENARIO 22: Duplicate matching requests do not duplicate allocations
      // -------------------------------------------------------------
      const dupSurplusId = await createVerifiedSurplus(20, 'Cooked Meals');
      const firstTriggerRes = await request(`/api/matching/trigger/${dupSurplusId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${canteenToken}` },
      });
      assert(firstTriggerRes.statusCode === 200, 'Sc22: First trigger succeeds');

      // Second trigger on same listing
      const secondTriggerRes = await request(`/api/matching/trigger/${dupSurplusId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${canteenToken}` },
      });
      // Should reject because available quantity is 0 or no remaining quantity to allocate
      assert(
        secondTriggerRes.statusCode === 400 || secondTriggerRes.data?.data?.allocations?.length === 0,
        'Sc22: Second matching trigger does not duplicate allocations'
      );

      // Verify no duplicate active allocations exist in DB
      const dupCheck = db.prepare(`
        SELECT center_id, COUNT(*) as cnt
        FROM matching_allocations
        WHERE surplus_id = ? AND status IN ('offered', 'accepted')
        GROUP BY center_id
      `).all(dupSurplusId);
      assert(dupCheck.every((r) => r.cnt === 1), 'Sc22: Exactly one active allocation per center in database');

      // -------------------------------------------------------------
      // 14. SCENARIO 23: Unauthorized users cannot trigger matching
      // -------------------------------------------------------------
      // Canteen 2 cannot trigger matching for Canteen 1's surplus
      const unauthCanteenRes = await request(`/api/matching/trigger/${dupSurplusId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${canteen2Token}` },
      });
      assert(unauthCanteenRes.statusCode === 403, 'Sc23: Canteen 2 blocked from triggering matching on Canteen 1 listing (HTTP 403)');

      // Volunteer cannot trigger matching
      const volTriggerRes = await request(`/api/matching/trigger/${dupSurplusId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${volToken}` },
      });
      assert(volTriggerRes.statusCode === 403, 'Sc23: Volunteer blocked from triggering matching (HTTP 403)');

      // -------------------------------------------------------------
      // 15. SCENARIO 24: One center cannot accept another center's offer
      // -------------------------------------------------------------
      const center1SurplusId = await createVerifiedSurplus(15, 'Cooked Meals');
      // Set travel time > 15 min on all centers except Center 1
      db.prepare(`UPDATE distribution_centers SET travel_time_min = 25 WHERE id != 1`).run();

      const trigRes = await request(`/api/matching/trigger/${center1SurplusId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${canteenToken}` },
      });
      const center1Alloc = trigRes.data?.data?.allocations?.[0];
      assert(!!center1Alloc && center1Alloc.centerId === 1, 'Sc24: Created offer for Center 1');

      // Restore travel times
      restoreSeedCapacities();

      // NGO 2 (Center 2) attempts to accept Center 1's offer
      const crossAcceptRes = await request(`/api/matching/offers/${center1Alloc.allocationId}/accept`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${ngo2Token}` },
      });
      assert(crossAcceptRes.statusCode === 403, 'Sc24: NGO 2 blocked from accepting Center 1 offer with HTTP 403');

      // -------------------------------------------------------------
      // 16. SCENARIO 25 & 26: Concurrent / Transactional atomicity
      // -------------------------------------------------------------
      const concurrentSurplusId = await createVerifiedSurplus(20, 'Cooked Meals');
      // Fire 3 simultaneous trigger requests
      const concurrentResults = await Promise.all([
        request(`/api/matching/trigger/${concurrentSurplusId}`, { method: 'POST', headers: { Authorization: `Bearer ${canteenToken}` } }),
        request(`/api/matching/trigger/${concurrentSurplusId}`, { method: 'POST', headers: { Authorization: `Bearer ${canteenToken}` } }),
        request(`/api/matching/trigger/${concurrentSurplusId}`, { method: 'POST', headers: { Authorization: `Bearer ${canteenToken}` } }),
      ]);

      // Check that total allocated weight across all allocations for this surplus does not exceed 20 kg
      const totalAllocatedRows = db.prepare(`
        SELECT COALESCE(SUM(allocated_kg), 0) as totalAllocated
        FROM matching_allocations
        WHERE surplus_id = ? AND status IN ('offered', 'accepted')
      `).get(concurrentSurplusId);

      assert(totalAllocatedRows.totalAllocated <= 20, 'Sc25: Concurrent requests cannot over-allocate food (allocated <= 20 kg)');
      assert(concurrentResults.some((r) => r.statusCode === 200), 'Sc25: At least one concurrent request succeeds atomically');

      // -------------------------------------------------------------
      // 17. SCENARIO 27: Fallback skips food that became unsafe or expired
      // -------------------------------------------------------------
      const unsafeSurplusId = await createVerifiedSurplus(20, 'Cooked Meals');
      const trigUnsafeRes = await request(`/api/matching/trigger/${unsafeSurplusId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${canteenToken}` },
      });
      const unsafeAlloc = trigUnsafeRes.data?.data?.allocations?.[0];
      assert(!!unsafeAlloc, 'Sc27: Created allocation for safety-invalidated fallback test');

      // Now reject safety on the surplus listing
      await request(`/api/surplus/${unsafeSurplusId}/safety`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${safetyToken}` },
        body: { safetyStatus: 'rejected', notes: 'Food spoiled after delivery prep' },
      });

      // Rejecting the offer now should restore capacity without creating any fallback allocation
      const rejectAfterUnsafeRes = await request(`/api/matching/offers/${unsafeAlloc.allocationId}/reject`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${adminToken}` },
        body: { rejectionReason: 'Center decline' },
      });
      const fallbackOnUnsafe = rejectAfterUnsafeRes.data?.data?.fallbackMatching;
      assert(
        !fallbackOnUnsafe || fallbackOnUnsafe.allocations?.length === 0,
        'Sc27: Fallback matching does not allocate food marked as unsafe'
      );

      // -------------------------------------------------------------
      // 18. SCENARIO 28: Notification records created
      // -------------------------------------------------------------
      const notifyCheck = db.prepare(`
        SELECT COUNT(*) as count FROM notifications
        WHERE type IN ('offer', 'match')
      `).get();
      assert(notifyCheck.count > 0, 'Sc28: Notification records generated for matching and offer events');

      // Clean up test data at the end of the test run
      db.prepare('DELETE FROM matching_allocations WHERE id > 2').run();
      db.prepare('DELETE FROM food_surplus_listings WHERE id > 22').run();
      restoreSeedCapacities();

      // Summary
      console.log(`\n📊 Phase 4 Test Summary: ${passed}/${total} checks passed.`);
      if (passed === total) {
        console.log('✨ Phase 4 Intelligent Matching & Allocation is 100% Verified and Robust!\n');
      } else {
        console.log(`⚠️  ${total - passed} check(s) failed.\n`);
      }

      server.close(() => {
        console.log('Phase 4 test server closed cleanly.');
        process.exit(passed === total ? 0 : 1);
      });
    } catch (err) {
      console.error('Phase 4 test execution error:', err);
      restoreSeedCapacities();
      server.close(() => process.exit(1));
    }
  });

  server.on('error', (err) => {
    console.error('Phase 4 test server failed to start:', err.message);
    process.exit(1);
  });
}

runPhase4Tests();