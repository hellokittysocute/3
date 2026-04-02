-- ============================================
-- Supabase Schema: 3월 중점관리 품목 대시보드
-- ============================================

-- 1. dashboard_items 테이블 (CSV 원본 데이터)
CREATE TABLE IF NOT EXISTS dashboard_items (
  id TEXT PRIMARY KEY,
  cis_manager TEXT DEFAULT '',
  category TEXT DEFAULT '',
  customer_code TEXT NOT NULL DEFAULT '',
  customer_name TEXT DEFAULT '',
  team_name TEXT DEFAULT '',
  sales_manager TEXT DEFAULT '',
  created_date TEXT DEFAULT '',
  original_due_date TEXT DEFAULT '',
  order_lead_time NUMERIC DEFAULT 0,
  changed_due_date TEXT DEFAULT '',
  due_month INTEGER DEFAULT 3,
  material_code TEXT DEFAULT '',
  item_name TEXT DEFAULT '',
  total_quantity NUMERIC DEFAULT 0,
  order_quantity NUMERIC DEFAULT 0,
  delivered_quantity NUMERIC DEFAULT 0,
  remaining_quantity NUMERIC DEFAULT 0,
  material_source TEXT DEFAULT '',
  production_request_date TEXT DEFAULT '',
  material_status TEXT DEFAULT '',
  week1 TEXT DEFAULT '',
  week2 TEXT DEFAULT '',
  week3 TEXT DEFAULT '',
  delay_days NUMERIC DEFAULT 0,
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
  original_order_quantity NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dashboard_items_customer ON dashboard_items(customer_code);
CREATE INDEX IF NOT EXISTS idx_dashboard_items_management ON dashboard_items(management_type);
CREATE INDEX IF NOT EXISTS idx_dashboard_items_status ON dashboard_items(status);

-- 2. edit_data 테이블 (사용자 편집 데이터)
CREATE TABLE IF NOT EXISTS edit_data (
  item_id TEXT PRIMARY KEY REFERENCES dashboard_items(id),
  production_complete_date TEXT DEFAULT '',
  material_setting_date TEXT DEFAULT '',
  manufacturing_date TEXT DEFAULT '',
  packaging_date TEXT DEFAULT '',
  revenue_possible TEXT DEFAULT '',
  revenue_possible_quantity NUMERIC DEFAULT 0,
  delay_reason TEXT DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Realtime 활성화
ALTER PUBLICATION supabase_realtime ADD TABLE edit_data;

-- 3. RLS 정책 (모든 사용자 허용)
ALTER TABLE dashboard_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE edit_data ENABLE ROW LEVEL SECURITY;

-- dashboard_items: 인증된 사용자만 CRUD
CREATE POLICY "dashboard_items_select" ON dashboard_items FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "dashboard_items_insert" ON dashboard_items FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "dashboard_items_update" ON dashboard_items FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "dashboard_items_delete" ON dashboard_items FOR DELETE USING (auth.uid() IS NOT NULL);

CREATE POLICY "Allow all reads on edit_data" ON edit_data FOR SELECT USING (true);
CREATE POLICY "Allow all inserts on edit_data" ON edit_data FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all updates on edit_data" ON edit_data FOR UPDATE USING (true);
CREATE POLICY "Allow all deletes on edit_data" ON edit_data FOR DELETE USING (true);

-- 4. monthly_snapshots 테이블 (월별 마감 스냅샷)
CREATE TABLE IF NOT EXISTS monthly_snapshots (
  id BIGSERIAL PRIMARY KEY,
  month TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT DEFAULT '',
  item_count INTEGER DEFAULT 0,
  total_revenue NUMERIC DEFAULT 0,
  data JSONB DEFAULT '[]'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_snapshots_month ON monthly_snapshots(month);

ALTER TABLE monthly_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all reads on monthly_snapshots" ON monthly_snapshots FOR SELECT USING (true);
CREATE POLICY "Allow all inserts on monthly_snapshots" ON monthly_snapshots FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all deletes on monthly_snapshots" ON monthly_snapshots FOR DELETE USING (true);
