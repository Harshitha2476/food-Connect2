-- Campus FoodConnect Database Schema (SQLite)
-- Strict relational design with foreign keys, constraints, and audit capability.

-- 1. USERS TABLE
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('canteen', 'ngo', 'volunteer', 'admin', 'safety_officer')),
  organization TEXT NOT NULL,
  phone TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 2. CANTEENS TABLE
CREATE TABLE IF NOT EXISTS canteens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  location TEXT NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  coordinator_name TEXT NOT NULL,
  coordinator_phone TEXT,
  sustainability_score INTEGER NOT NULL DEFAULT 75 CHECK (sustainability_score >= 0 AND sustainability_score <= 100),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 3. DISTRIBUTION CENTERS TABLE
CREATE TABLE IF NOT EXISTS distribution_centers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  travel_time_min INTEGER NOT NULL DEFAULT 10 CHECK (travel_time_min >= 0),
  capacity_kg REAL NOT NULL CHECK (capacity_kg >= 0),
  available_capacity_kg REAL NOT NULL CHECK (available_capacity_kg >= 0 AND available_capacity_kg <= capacity_kg),
  contact_person TEXT NOT NULL,
  contact_phone TEXT NOT NULL,
  is_verified INTEGER NOT NULL DEFAULT 1 CHECK (is_verified IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 4. FOOD DEMAND TABLE (Recorded by Distribution Centers)
CREATE TABLE IF NOT EXISTS food_demand (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  center_id INTEGER NOT NULL REFERENCES distribution_centers(id) ON DELETE CASCADE,
  categories TEXT NOT NULL DEFAULT '[]', -- JSON array of strings e.g. ["Cooked Meals", "Rice"]
  demand_kg REAL NOT NULL DEFAULT 0 CHECK (demand_kg >= 0),
  urgency TEXT NOT NULL DEFAULT 'medium' CHECK (urgency IN ('low', 'medium', 'high')),
  dietary_notes TEXT,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 5. FOOD SURPLUS LISTINGS TABLE
CREATE TABLE IF NOT EXISTS food_surplus_listings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  canteen_id INTEGER NOT NULL REFERENCES canteens(id) ON DELETE CASCADE,
  food_name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('Cooked Meals', 'Rice', 'Vegetables', 'Fruits', 'Bakery', 'Other')),
  quantity_kg REAL NOT NULL CHECK (quantity_kg > 0),
  available_quantity_kg REAL NOT NULL CHECK (available_quantity_kg >= 0 AND available_quantity_kg <= quantity_kg),
  preparation_date TEXT NOT NULL,
  preparation_time TEXT NOT NULL,
  storage_method TEXT NOT NULL CHECK (storage_method IN ('Hot holding', 'Refrigerated', 'Room temperature', 'Frozen')),
  storage_temp TEXT,
  ingredients TEXT,
  allergens TEXT,
  pickup_deadline TEXT NOT NULL,
  location TEXT NOT NULL,
  notes TEXT,
  photo_url TEXT,
  safety_status TEXT NOT NULL DEFAULT 'pending' CHECK (safety_status IN ('pending', 'verified', 'rejected')),
  safety_verified_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  safety_verified_at TEXT,
  safety_notes TEXT,
  matching_status TEXT NOT NULL DEFAULT 'available' CHECK (matching_status IN ('available', 'matched', 'pending_collection', 'in_transit', 'delivered', 'cancelled', 'expired')),
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'matched', 'pending_collection', 'in_transit', 'delivered', 'cancelled', 'expired')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 6. MATCHING ALLOCATIONS TABLE
CREATE TABLE IF NOT EXISTS matching_allocations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  surplus_id INTEGER NOT NULL REFERENCES food_surplus_listings(id) ON DELETE CASCADE,
  center_id INTEGER NOT NULL REFERENCES distribution_centers(id) ON DELETE CASCADE,
  allocated_kg REAL NOT NULL CHECK (allocated_kg > 0),
  match_score REAL NOT NULL CHECK (match_score >= 0 AND match_score <= 100),
  demand_score REAL NOT NULL CHECK (demand_score >= 0 AND demand_score <= 100),
  capacity_score REAL NOT NULL CHECK (capacity_score >= 0 AND capacity_score <= 100),
  travel_score REAL NOT NULL CHECK (travel_score >= 0 AND travel_score <= 100),
  urgency_score REAL NOT NULL CHECK (urgency_score >= 0 AND urgency_score <= 100),
  travel_time_min INTEGER NOT NULL CHECK (travel_time_min >= 0),
  status TEXT NOT NULL DEFAULT 'offered' CHECK (status IN ('offered', 'accepted', 'rejected', 'expired', 'completed', 'cancelled')),
  rejection_reason TEXT,
  offered_at TEXT NOT NULL DEFAULT (datetime('now')),
  responded_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Prevent duplicate active offers/allocations for the same surplus and center
CREATE UNIQUE INDEX IF NOT EXISTS idx_active_surplus_center_allocation 
  ON matching_allocations (surplus_id, center_id) 
  WHERE status IN ('offered', 'accepted');

-- 7. PICKUP RECORDS TABLE
CREATE TABLE IF NOT EXISTS pickup_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  allocation_id INTEGER NOT NULL REFERENCES matching_allocations(id) ON DELETE CASCADE,
  surplus_id INTEGER NOT NULL REFERENCES food_surplus_listings(id) ON DELETE CASCADE,
  center_id INTEGER NOT NULL REFERENCES distribution_centers(id) ON DELETE CASCADE,
  canteen_id INTEGER NOT NULL REFERENCES canteens(id) ON DELETE CASCADE,
  volunteer_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  quantity_kg REAL NOT NULL CHECK (quantity_kg > 0),
  pickup_deadline TEXT NOT NULL,
  travel_time_min INTEGER NOT NULL DEFAULT 10 CHECK (travel_time_min >= 0),
  otp TEXT NOT NULL CHECK (length(otp) = 4),
  qr_code_hash TEXT,
  status TEXT NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned', 'pickup_pending', 'collected', 'in_transit', 'delivered', 'cancelled')),
  collected_at TEXT,
  delivered_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 8. DELIVERY RECORDS TABLE
CREATE TABLE IF NOT EXISTS delivery_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pickup_id INTEGER NOT NULL REFERENCES pickup_records(id) ON DELETE CASCADE,
  delivered_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  received_by_center_id INTEGER NOT NULL REFERENCES distribution_centers(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'in_transit' CHECK (status IN ('in_transit', 'delivered', 'failed')),
  delivery_proof_photo TEXT,
  recipient_signature TEXT,
  notes TEXT,
  delivered_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 9. NOTIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  recipient_role TEXT CHECK (recipient_role IN ('canteen', 'ngo', 'volunteer', 'admin', 'safety_officer', 'all')),
  type TEXT NOT NULL CHECK (type IN ('offer', 'match', 'pickup', 'delivery', 'safety', 'alert', 'system')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data_json TEXT,
  is_read INTEGER NOT NULL DEFAULT 0 CHECK (is_read IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 10. FEEDBACK TABLE
CREATE TABLE IF NOT EXISTS feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  surplus_id INTEGER REFERENCES food_surplus_listings(id) ON DELETE SET NULL,
  pickup_id INTEGER REFERENCES pickup_records(id) ON DELETE SET NULL,
  from_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_entity_type TEXT NOT NULL CHECK (to_entity_type IN ('canteen', 'center', 'volunteer')),
  to_entity_id INTEGER NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comments TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 11. AUDIT LOGS TABLE
CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id INTEGER,
  details_json TEXT,
  ip_address TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- PERFORMANCE AND QUERY INDEXES
CREATE INDEX IF NOT EXISTS idx_canteens_user_id ON canteens(user_id);
CREATE INDEX IF NOT EXISTS idx_centers_user_id ON distribution_centers(user_id);
CREATE INDEX IF NOT EXISTS idx_food_demand_center_id ON food_demand(center_id);
CREATE INDEX IF NOT EXISTS idx_surplus_canteen_id ON food_surplus_listings(canteen_id);
CREATE INDEX IF NOT EXISTS idx_surplus_status_safety ON food_surplus_listings(status, safety_status);
CREATE INDEX IF NOT EXISTS idx_allocations_surplus_id ON matching_allocations(surplus_id);
CREATE INDEX IF NOT EXISTS idx_allocations_center_id ON matching_allocations(center_id);
CREATE INDEX IF NOT EXISTS idx_allocations_status ON matching_allocations(status);
CREATE INDEX IF NOT EXISTS idx_pickups_volunteer_id ON pickup_records(volunteer_id);
CREATE INDEX IF NOT EXISTS idx_pickups_status ON pickup_records(status);
CREATE INDEX IF NOT EXISTS idx_deliveries_pickup_id ON delivery_records(pickup_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_audit_user_created ON audit_logs(user_id, created_at);

