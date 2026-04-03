-- ============================================
-- 사내 PostgreSQL 테이블 생성 스크립트
-- 스키마: app_mktdashboard_prd
-- DB: cip001.cosmaxhub.com:5432/Postgres
-- ============================================

CREATE SCHEMA IF NOT EXISTS app_mktdashboard_prd;
SET search_path TO app_mktdashboard_prd;

-- 1. 대시보드 아이템 (중점관리품목)
CREATE TABLE IF NOT EXISTS dashboard_items (
  id TEXT PRIMARY KEY,
  cis_manager TEXT DEFAULT '',
  category TEXT DEFAULT '',
  customer_code TEXT DEFAULT '',
  customer_name TEXT DEFAULT '',
  team_name TEXT DEFAULT '',
  sales_manager TEXT DEFAULT '',
  created_date TEXT DEFAULT '',
  original_due_date TEXT DEFAULT '',
  order_lead_time INTEGER DEFAULT 0,
  changed_due_date TEXT DEFAULT '',
  due_month INTEGER DEFAULT 3,
  material_code TEXT DEFAULT '',
  item_name TEXT DEFAULT '',
  total_quantity INTEGER DEFAULT 0,
  order_quantity INTEGER DEFAULT 0,
  delivered_quantity INTEGER DEFAULT 0,
  remaining_quantity INTEGER DEFAULT 0,
  material_source TEXT DEFAULT '',
  production_request_date TEXT DEFAULT '',
  material_status TEXT DEFAULT '',
  week1 TEXT DEFAULT '',
  week2 TEXT DEFAULT '',
  week3 TEXT DEFAULT '',
  delay_days INTEGER DEFAULT 0,
  production_request_yn TEXT DEFAULT '',
  mfg1 TEXT DEFAULT '',
  mfg_final TEXT DEFAULT '',
  pkg1 TEXT DEFAULT '',
  pkg_final TEXT DEFAULT '',
  production_site TEXT DEFAULT '',
  lead_time TEXT DEFAULT '',
  status TEXT DEFAULT '확인중',
  progress_rate TEXT DEFAULT '',
  delay_reason TEXT DEFAULT '',
  management_type TEXT DEFAULT '중점관리품목',
  management_note TEXT DEFAULT '',
  unit_price NUMERIC DEFAULT 0,
  sales_document TEXT DEFAULT '',
  original_order_quantity INTEGER DEFAULT 0
);

-- 2. 편집 데이터 (중점관리품목)
CREATE TABLE IF NOT EXISTS edit_data (
  item_id TEXT PRIMARY KEY,
  write_date TEXT DEFAULT '',
  production_complete_date TEXT DEFAULT '',
  material_setting_date TEXT DEFAULT '',
  manufacturing_date TEXT DEFAULT '',
  packaging_date TEXT DEFAULT '',
  material_setting_filled_at TEXT DEFAULT '',
  manufacturing_filled_at TEXT DEFAULT '',
  packaging_filled_at TEXT DEFAULT '',
  revenue_possible_filled_at TEXT DEFAULT '',
  revenue_possible TEXT DEFAULT '확인중',
  revenue_possible_quantity NUMERIC DEFAULT 0,
  delay_reason TEXT DEFAULT '',
  revenue_reflected TEXT DEFAULT '',
  importance TEXT DEFAULT '',
  production_site TEXT DEFAULT '',
  purchase_manager TEXT DEFAULT '',
  note TEXT DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 전체 품목
CREATE TABLE IF NOT EXISTS all_items (
  id TEXT PRIMARY KEY,
  cis_manager TEXT DEFAULT '',
  category TEXT DEFAULT '',
  customer_code TEXT DEFAULT '',
  customer_name TEXT DEFAULT '',
  team_name TEXT DEFAULT '',
  sales_manager TEXT DEFAULT '',
  created_date TEXT DEFAULT '',
  original_due_date TEXT DEFAULT '',
  order_lead_time INTEGER DEFAULT 0,
  changed_due_date TEXT DEFAULT '',
  due_month INTEGER DEFAULT 3,
  material_code TEXT DEFAULT '',
  item_name TEXT DEFAULT '',
  total_quantity INTEGER DEFAULT 0,
  order_quantity INTEGER DEFAULT 0,
  delivered_quantity INTEGER DEFAULT 0,
  remaining_quantity INTEGER DEFAULT 0,
  material_source TEXT DEFAULT '',
  production_request_date TEXT DEFAULT '',
  material_status TEXT DEFAULT '',
  week1 TEXT DEFAULT '',
  week2 TEXT DEFAULT '',
  week3 TEXT DEFAULT '',
  delay_days INTEGER DEFAULT 0,
  production_request_yn TEXT DEFAULT '',
  mfg1 TEXT DEFAULT '',
  mfg_final TEXT DEFAULT '',
  pkg1 TEXT DEFAULT '',
  pkg_final TEXT DEFAULT '',
  production_site TEXT DEFAULT '',
  lead_time TEXT DEFAULT '',
  status TEXT DEFAULT '확인중',
  progress_rate TEXT DEFAULT '',
  delay_reason TEXT DEFAULT '',
  management_type TEXT DEFAULT '중점관리품목',
  management_note TEXT DEFAULT '',
  unit_price NUMERIC DEFAULT 0,
  sales_document TEXT DEFAULT '',
  original_order_quantity INTEGER DEFAULT 0
);

-- 4. 전체 품목 편집 데이터
CREATE TABLE IF NOT EXISTS all_items_edit_data (
  item_id TEXT PRIMARY KEY,
  write_date TEXT DEFAULT '',
  production_complete_date TEXT DEFAULT '',
  material_setting_date TEXT DEFAULT '',
  manufacturing_date TEXT DEFAULT '',
  packaging_date TEXT DEFAULT '',
  material_setting_filled_at TEXT DEFAULT '',
  manufacturing_filled_at TEXT DEFAULT '',
  packaging_filled_at TEXT DEFAULT '',
  revenue_possible_filled_at TEXT DEFAULT '',
  revenue_possible TEXT DEFAULT '확인중',
  revenue_possible_quantity NUMERIC DEFAULT 0,
  delay_reason TEXT DEFAULT '',
  revenue_reflected TEXT DEFAULT '',
  importance TEXT DEFAULT '',
  production_site TEXT DEFAULT '',
  purchase_manager TEXT DEFAULT '',
  note TEXT DEFAULT '',
  material_arrival_expected TEXT DEFAULT '',
  material_arrival_actual TEXT DEFAULT '',
  production_complete_actual TEXT DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. 설정값
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. 월별 스냅샷
CREATE TABLE IF NOT EXISTS monthly_snapshots (
  id SERIAL PRIMARY KEY,
  month TEXT NOT NULL,
  label TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT DEFAULT '',
  item_count INTEGER DEFAULT 0,
  total_revenue NUMERIC DEFAULT 0,
  data JSONB DEFAULT '[]'::jsonb
);

-- 7. 사용자 프로필
CREATE TABLE IF NOT EXISTS user_profiles (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT DEFAULT '',
  avatar_url TEXT DEFAULT '',
  role TEXT DEFAULT 'user',
  status TEXT DEFAULT 'inactive',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_dashboard_items_customer ON dashboard_items(customer_code);
CREATE INDEX IF NOT EXISTS idx_edit_data_item ON edit_data(item_id);
CREATE INDEX IF NOT EXISTS idx_all_items_customer ON all_items(customer_code);
CREATE INDEX IF NOT EXISTS idx_all_items_edit_item ON all_items_edit_data(item_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_month ON monthly_snapshots(month);
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);
