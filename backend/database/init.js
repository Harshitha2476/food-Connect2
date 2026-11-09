const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { getDatabase } = require('./connection');

/**
 * Initializes database tables using schema.sql and seeds initial demo data.
 */
function initDatabase() {
  const db = getDatabase();
  console.log('📦 Connected to SQLite database.');

  // 1. Read and apply schema
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  db.exec(schemaSql);
  console.log('✅ Schema tables and indexes created successfully.');

  // 2. Check if users already seeded
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  if (userCount > 0) {
    console.log(`ℹ️ Database already contains ${userCount} users. Skipping seed.`);
    return;
  }

  console.log('🌱 Seeding initial demo data compatible with frontend...');

  const insertUser = db.prepare(`
    INSERT INTO users (name, email, password_hash, role, organization, phone)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const insertCanteen = db.prepare(`
    INSERT INTO canteens (user_id, name, location, lat, lng, coordinator_name, coordinator_phone, sustainability_score)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertCenter = db.prepare(`
    INSERT INTO distribution_centers (
      user_id, name, address, lat, lng, travel_time_min, capacity_kg, available_capacity_kg, contact_person, contact_phone, is_verified
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertDemand = db.prepare(`
    INSERT INTO food_demand (center_id, categories, demand_kg, urgency, dietary_notes)
    VALUES (?, ?, ?, ?, ?)
  `);

  const insertSurplus = db.prepare(`
    INSERT INTO food_surplus_listings (
      canteen_id, food_name, category, quantity_kg, available_quantity_kg,
      preparation_date, preparation_time, storage_method, storage_temp,
      ingredients, allergens, pickup_deadline, location, notes, photo_url,
      safety_status, matching_status, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertPickup = db.prepare(`
    INSERT INTO pickup_records (
      allocation_id, surplus_id, center_id, canteen_id, volunteer_id,
      quantity_kg, pickup_deadline, travel_time_min, otp, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertAllocation = db.prepare(`
    INSERT INTO matching_allocations (
      surplus_id, center_id, allocated_kg, match_score, demand_score, capacity_score,
      travel_score, urgency_score, travel_time_min, status, offered_at, responded_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '-15 minutes'), datetime('now', '-10 minutes'))
  `);

  const insertNotification = db.prepare(`
    INSERT INTO notifications (user_id, recipient_role, type, title, message, data_json)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const insertAudit = db.prepare(`
    INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details_json)
    VALUES (?, ?, ?, ?, ?)
  `);

  // Wrap all seeding in a transaction
  const seedTransaction = db.transaction(() => {
    // 1. Users
    const canteenPassHash = bcrypt.hashSync('canteen123', 10);
    const ngoPassHash = bcrypt.hashSync('ngo123', 10);
    const volunteerPassHash = bcrypt.hashSync('volunteer123', 10);
    const adminPassHash = bcrypt.hashSync('admin123', 10);
    const safetyPassHash = bcrypt.hashSync('safety123', 10);

    const uCanteen = insertUser.run('Priya Sharma', 'canteen@campus.edu', canteenPassHash, 'canteen', 'Main Campus Canteen', '+91 98765 43210');
    const uNgo = insertUser.run('Rahul Mehta', 'ngo@hopekitchen.org', ngoPassHash, 'ngo', 'Hope Kitchen NGO', '+91 98765 43211');
    const uVol = insertUser.run('Ananya Patel', 'volunteer@campus.edu', volunteerPassHash, 'volunteer', 'Campus Volunteers', '+91 98765 43212');
    const uAdmin = insertUser.run('Dr. Suresh Kumar', 'admin@campus.edu', adminPassHash, 'admin', 'Campus Administration', '+91 98765 43213');
    const uSafety = insertUser.run('Dr. Anita Desai', 'safety@campus.edu', safetyPassHash, 'safety_officer', 'Campus Food Safety Board', '+91 98765 43214');

    // Additional canteens & centers users
    const uCanteen2 = insertUser.run('Vikram Rao', 'engg.mess@campus.edu', canteenPassHash, 'canteen', 'Engineering Block Mess', '+91 98765 43215');
    const uCanteen3 = insertUser.run('Meera Nair', 'hostel.dining@campus.edu', canteenPassHash, 'canteen', 'Hostel Dining Hall', '+91 98765 43216');
    const uNgo2 = insertUser.run('Sunita Devi', 'sunita@communityfoodbank.org', ngoPassHash, 'ngo', 'Community Food Bank', '+91 98765 44100');
    const uNgo3 = insertUser.run('Arjun Singh', 'arjun@cityshelter.org', ngoPassHash, 'ngo', 'City Shelter Network', '+91 98765 44200');
    const uVol2 = insertUser.run('Karthik Reddy', 'karthik@campus.edu', volunteerPassHash, 'volunteer', 'Campus Volunteers', '+91 98765 45100');

    // 2. Canteens
    const c1 = insertCanteen.run(uCanteen.lastInsertRowid, 'Main Campus Canteen', 'Block A, Ground Floor', 12.9716, 77.5946, 'Priya Sharma', '+91 98765 43210', 87);
    const c2 = insertCanteen.run(uCanteen2.lastInsertRowid, 'Engineering Block Mess', 'Engineering Block, Basement', 12.9730, 77.5960, 'Vikram Rao', '+91 98765 43215', 72);
    const c3 = insertCanteen.run(uCanteen3.lastInsertRowid, 'Hostel Dining Hall', 'Hostel Complex, Building 2', 12.9700, 77.5920, 'Meera Nair', '+91 98765 43216', 91);

    // 3. Distribution Centers
    const d1 = insertCenter.run(uNgo.lastInsertRowid, 'Hope Kitchen NGO', '12 MG Road, 1.2 km from campus', 12.9745, 77.5990, 8, 120, 85, 'Rahul Mehta', '+91 98765 43211', 1);
    const d2 = insertCenter.run(uNgo2.lastInsertRowid, 'Community Food Bank', '45 Ring Road, 2.1 km', 12.9680, 77.6010, 12, 200, 140, 'Sunita Devi', '+91 98765 44100', 1);
    const d3 = insertCenter.run(uNgo3.lastInsertRowid, 'City Shelter Network', 'Near Metro Station, 1.8 km', 12.9755, 77.5900, 10, 90, 55, 'Arjun Singh', '+91 98765 44200', 1);

    // 4. Food Demands for Centers
    insertDemand.run(d1.lastInsertRowid, JSON.stringify(['Cooked Meals', 'Rice', 'Vegetables']), 60, 'high', 'Immediate lunch distribution');
    insertDemand.run(d2.lastInsertRowid, JSON.stringify(['Fruits', 'Bakery', 'Vegetables']), 40, 'medium', 'Afternoon tea and bread drive');
    insertDemand.run(d3.lastInsertRowid, JSON.stringify(['Cooked Meals', 'Rice', 'Bakery']), 35, 'high', 'Evening shelter dinner service');

    // 5. Initial Food Surplus Listings
    const today = new Date().toISOString().slice(0, 10);
    const s1 = insertSurplus.run(
      c1.lastInsertRowid, 'Vegetable Biryani', 'Cooked Meals', 28, 0,
      today, '12:30', 'Hot holding', '65°C', 'Rice, mixed vegetables, spices, oil',
      'None', '15:00', 'Block A, Ground Floor', 'Prepared for lunch service; surplus after peak hour',
      null, 'verified', 'matched', 'matched'
    );

    const s2 = insertSurplus.run(
      c2.lastInsertRowid, 'Fresh Fruit Mix', 'Fruits', 15, 15,
      today, '09:00', 'Refrigerated', '4°C', 'Apple, banana, orange, papaya',
      'None', '17:00', 'Engineering Block, Basement', 'Cut fruit from breakfast buffet',
      null, 'pending', 'available', 'available'
    );

    const s3 = insertSurplus.run(
      c1.lastInsertRowid, 'Steamed Rice', 'Rice', 40, 40,
      today, '11:45', 'Hot holding', '70°C', 'White rice, water, salt',
      'None', '14:30', 'Block A, Ground Floor', 'Large batch surplus from lunch',
      null, 'verified', 'available', 'available'
    );

    const s4 = insertSurplus.run(
      c3.lastInsertRowid, 'Mixed Vegetable Curry', 'Vegetables', 22, 0,
      today, '12:00', 'Hot holding', '65°C', 'Potato, carrot, beans, tomato, spices',
      'None', '15:30', 'Hostel Complex, Building 2', 'Prepared for lunch; fresh batch',
      null, 'verified', 'pending_collection', 'pending_collection'
    );

    const s5 = insertSurplus.run(
      c2.lastInsertRowid, 'Bread & Pastries', 'Bakery', 12, 12,
      today, '07:30', 'Room temperature', '22°C', 'Wheat flour, butter, sugar, yeast',
      'Gluten, Dairy', '16:00', 'Engineering Block, Basement', 'Breakfast leftover bakery items',
      null, 'verified', 'available', 'available'
    );

    // 6. Matching Allocations
    const alloc1 = insertAllocation.run(s1.lastInsertRowid, d1.lastInsertRowid, 28, 92.5, 95.0, 90.0, 92.0, 100.0, 8, 'accepted');
    const alloc2 = insertAllocation.run(s4.lastInsertRowid, d3.lastInsertRowid, 22, 88.0, 85.0, 80.0, 90.0, 100.0, 10, 'accepted');

    // 7. Pickups
    insertPickup.run(
      alloc1.lastInsertRowid, s1.lastInsertRowid, d1.lastInsertRowid, c1.lastInsertRowid,
      uVol.lastInsertRowid, 28, '15:00', 8, '4821', 'assigned'
    );

    insertPickup.run(
      alloc2.lastInsertRowid, s4.lastInsertRowid, d3.lastInsertRowid, c3.lastInsertRowid,
      uVol2.lastInsertRowid, 22, '15:30', 10, '7390', 'in_transit'
    );

    // 8. Notifications
    insertNotification.run(uNgo.lastInsertRowid, 'ngo', 'offer', 'New Food Match Offer', 'Vegetable Biryani (28 kg) matched with Hope Kitchen NGO', JSON.stringify({ surplusId: s1.lastInsertRowid }));
    insertNotification.run(uVol.lastInsertRowid, 'volunteer', 'pickup', 'Pickup Assigned', 'You have been assigned to pick up 28 kg Vegetable Biryani from Main Campus Canteen', JSON.stringify({ surplusId: s1.lastInsertRowid, otp: '4821' }));

    // 9. Audit Logs
    insertAudit.run(uCanteen.lastInsertRowid, 'CREATE_LISTING', 'food_surplus_listings', s1.lastInsertRowid, JSON.stringify({ foodName: 'Vegetable Biryani', quantityKg: 28 }));
    insertAudit.run(uAdmin.lastInsertRowid, 'SYSTEM_INIT', 'database', 1, JSON.stringify({ event: 'Initial database seeding completed' }));
  });

  seedTransaction();
  console.log('🎉 Database initialized and seeded successfully with demo users and sample data.');
}

// Allow direct execution: node database/init.js
if (require.main === module) {
  try {
    initDatabase();
    process.exit(0);
  } catch (err) {
    console.error('❌ Failed to initialize database:', err);
    process.exit(1);
  }
}

module.exports = initDatabase;

