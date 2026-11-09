const { getDatabase, closeDatabase } = require('./connection');

/**
 * Comprehensive verification of the Phase 1 database setup:
 * 1. PRAGMAs (foreign keys, WAL mode)
 * 2. All 11 tables exist
 * 3. CHECK constraints prevent negative quantities
 * 4. Duplicate active allocations are blocked
 * 5. Data integrity and seed verification
 */
function runTests() {
  console.log('🧪 Starting Phase 1 Database Verification Tests...\n');
  const db = getDatabase();

  let passed = 0;
  let total = 0;

  function assert(condition, testName) {
    total++;
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
    }
  }

  // 1. Check PRAGMAs
  const fkPragma = db.pragma('foreign_keys', { simple: true });
  assert(fkPragma === 1, 'Foreign keys are enabled (PRAGMA foreign_keys = 1)');

  const journalMode = db.pragma('journal_mode', { simple: true });
  assert(journalMode.toLowerCase() === 'wal', `Journal mode is WAL (current: ${journalMode})`);

  // 2. Check all 11 tables exist
  const expectedTables = [
    'users',
    'canteens',
    'distribution_centers',
    'food_demand',
    'food_surplus_listings',
    'matching_allocations',
    'pickup_records',
    'delivery_records',
    'notifications',
    'feedback',
    'audit_logs',
  ];

  const existingTables = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
    .all()
    .map((r) => r.name);

  for (const table of expectedTables) {
    assert(existingTables.includes(table), `Table exists: '${table}'`);
  }

  // 3. Test negative quantity constraint
  let caughtNegativeQuantity = false;
  try {
    db.prepare(`
      INSERT INTO food_surplus_listings (
        canteen_id, food_name, category, quantity_kg, available_quantity_kg,
        preparation_date, preparation_time, storage_method, pickup_deadline, location
      ) VALUES (1, 'Bad Food', 'Cooked Meals', -5.0, -5.0, '2026-11-09', '12:00', 'Hot holding', '14:00', 'Building A')
    `).run();
  } catch (err) {
    caughtNegativeQuantity = true;
  }
  assert(caughtNegativeQuantity, 'CHECK constraint blocks negative surplus quantity (quantity_kg > 0)');

  // 4. Test duplicate active allocation index
  let caughtDuplicateAllocation = false;
  try {
    // Attempt duplicate offer for surplus 1 and center 1 while status is 'offered' or 'accepted'
    db.prepare(`
      INSERT INTO matching_allocations (
        surplus_id, center_id, allocated_kg, match_score, demand_score,
        capacity_score, travel_score, urgency_score, travel_time_min, status
      ) VALUES (1, 1, 10, 85, 90, 80, 85, 90, 8, 'offered')
    `).run();
  } catch (err) {
    caughtDuplicateAllocation = true;
  }
  assert(caughtDuplicateAllocation, 'Unique partial index blocks duplicate active allocation for same surplus & center');

  // 5. Verify seeded users and role coverage
  const users = db.prepare('SELECT role, COUNT(*) as count FROM users GROUP BY role').all();
  const rolesFound = users.map((u) => u.role);
  assert(rolesFound.includes('canteen'), 'Seeded user with role: canteen');
  assert(rolesFound.includes('ngo'), 'Seeded user with role: ngo');
  assert(rolesFound.includes('volunteer'), 'Seeded user with role: volunteer');
  assert(rolesFound.includes('admin'), 'Seeded user with role: admin');
  assert(rolesFound.includes('safety_officer'), 'Seeded user with role: safety_officer');

  // 6. Verify canteens and centers
  const canteenCount = db.prepare('SELECT COUNT(*) as c FROM canteens').get().c;
  const centerCount = db.prepare('SELECT COUNT(*) as c FROM distribution_centers').get().c;
  const surplusCount = db.prepare('SELECT COUNT(*) as c FROM food_surplus_listings').get().c;
  assert(canteenCount >= 3, `Seeded canteens found: ${canteenCount}`);
  assert(centerCount >= 3, `Seeded distribution centers found: ${centerCount}`);
  assert(surplusCount >= 5, `Seeded surplus listings found: ${surplusCount}`);

  console.log(`\n📊 Test Summary: ${passed}/${total} checks passed.`);
  closeDatabase();

  if (passed === total) {
    console.log('✨ Phase 1 Database Foundation is 100% Verified and Healthy!\n');
    return true;
  } else {
    console.error('❌ Some tests failed.');
    process.exit(1);
  }
}

if (require.main === module) {
  runTests();
}

module.exports = runTests;

