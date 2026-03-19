-- ============================================
-- Supabase 보안 문제 수정 SQL
-- Supabase SQL Editor에서 실행하세요
-- ============================================
-- 수정 항목:
--   1. profiles 테이블 RLS 활성화 + 정책 추가
--   2. user_profiles 테이블 RLS 정책 추가 (없을 경우)
--   3. development_costs 테이블 RLS 정책 추가
--   4. price_master 테이블 RLS 정책 추가
--   5. settings 테이블 RLS 정책 추가
--   6. 함수 search_path 보안 설정
-- ============================================

-- ============================================
-- 0. 기존 정책 삭제 (dashboard_items, edit_data)
-- ============================================
-- 이전에 생성된 정책이 있으면 삭제 후 재생성

-- dashboard_items 기존 정책 삭제
DROP POLICY IF EXISTS "Allow all reads on dashboard_items" ON dashboard_items;
DROP POLICY IF EXISTS "Allow all inserts on dashboard_items" ON dashboard_items;
DROP POLICY IF EXISTS "Allow all updates on dashboard_items" ON dashboard_items;
DROP POLICY IF EXISTS "Allow all deletes on dashboard_items" ON dashboard_items;
DROP POLICY IF EXISTS "dashboard_items_select" ON dashboard_items;
DROP POLICY IF EXISTS "dashboard_items_insert" ON dashboard_items;
DROP POLICY IF EXISTS "dashboard_items_update" ON dashboard_items;
DROP POLICY IF EXISTS "dashboard_items_delete" ON dashboard_items;

-- edit_data 기존 정책 삭제
DROP POLICY IF EXISTS "Allow all reads on edit_data" ON edit_data;
DROP POLICY IF EXISTS "Allow all inserts on edit_data" ON edit_data;
DROP POLICY IF EXISTS "Allow all updates on edit_data" ON edit_data;
DROP POLICY IF EXISTS "Allow all deletes on edit_data" ON edit_data;
DROP POLICY IF EXISTS "edit_data_select" ON edit_data;
DROP POLICY IF EXISTS "edit_data_insert" ON edit_data;
DROP POLICY IF EXISTS "edit_data_update" ON edit_data;
DROP POLICY IF EXISTS "edit_data_delete" ON edit_data;

-- dashboard_items: 인증된 사용자만 CRUD
CREATE POLICY "dashboard_items_select" ON dashboard_items FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "dashboard_items_insert" ON dashboard_items FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "dashboard_items_update" ON dashboard_items FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "dashboard_items_delete" ON dashboard_items FOR DELETE USING (auth.uid() IS NOT NULL);

-- edit_data: 인증된 사용자만 CRUD
CREATE POLICY "edit_data_select" ON edit_data FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "edit_data_insert" ON edit_data FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "edit_data_update" ON edit_data FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "edit_data_delete" ON edit_data FOR DELETE USING (auth.uid() IS NOT NULL);


-- ============================================
-- 1. profiles 테이블 RLS
-- ============================================
-- Supabase가 auth.users 연동으로 자동 생성한 profiles 테이블
-- RLS가 비활성화되어 있으면 모든 사용자가 다른 사용자 프로필 접근 가능

DO $$
BEGIN
  -- profiles 테이블이 존재하는 경우에만 실행
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
    -- RLS 활성화
    ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

    -- 기존 정책 삭제 (중복 방지)
    DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
    DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
    DROP POLICY IF EXISTS "profiles_update_own" ON profiles;

    -- 자기 프로필만 조회 가능
    CREATE POLICY "profiles_select_own" ON profiles
      FOR SELECT USING (auth.uid() = id);

    -- 자기 프로필만 생성 가능
    CREATE POLICY "profiles_insert_own" ON profiles
      FOR INSERT WITH CHECK (auth.uid() = id);

    -- 자기 프로필만 수정 가능
    CREATE POLICY "profiles_update_own" ON profiles
      FOR UPDATE USING (auth.uid() = id);

    RAISE NOTICE 'profiles: RLS 활성화 및 정책 적용 완료';
  ELSE
    RAISE NOTICE 'profiles: 테이블이 존재하지 않음 - 스킵';
  END IF;
END $$;


-- ============================================
-- 2. user_profiles 테이블 RLS (profiles 또는 user_profiles)
-- ============================================
-- DB에 실제 존재하는 프로필 테이블명을 자동 감지하여 적용

-- 2a. profiles 테이블 (DB에 profiles로 존재하는 경우)
-- 섹션 1에서 자기것만 조회 정책을 넣었으므로, 관리자용 정책 추가
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
    -- 섹션 1의 자기것만 조회 정책 삭제 → 전체 조회로 교체 (관리자 화면 필요)
    DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
    DROP POLICY IF EXISTS "profiles_select_authenticated" ON profiles;
    DROP POLICY IF EXISTS "profiles_update_admin" ON profiles;

    -- 모든 인증된 사용자가 프로필 목록 조회 가능 (관리자 화면용)
    CREATE POLICY "profiles_select_authenticated" ON profiles
      FOR SELECT USING (auth.uid() IS NOT NULL);

    -- 관리자 또는 본인만 수정 가능
    DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
    CREATE POLICY "profiles_update_admin" ON profiles
      FOR UPDATE USING (
        auth.uid() = id
        OR EXISTS (
          SELECT 1 FROM profiles
          WHERE id = auth.uid() AND role = 'admin'
        )
      );

    RAISE NOTICE 'profiles: 관리자 정책 적용 완료';
  END IF;
END $$;

-- 2b. user_profiles 테이블 (DB에 user_profiles로 존재하는 경우)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_profiles') THEN
    ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "user_profiles_select_all" ON user_profiles;
    DROP POLICY IF EXISTS "user_profiles_insert_own" ON user_profiles;
    DROP POLICY IF EXISTS "user_profiles_update_admin" ON user_profiles;

    CREATE POLICY "user_profiles_select_all" ON user_profiles
      FOR SELECT USING (auth.uid() IS NOT NULL);

    CREATE POLICY "user_profiles_insert_own" ON user_profiles
      FOR INSERT WITH CHECK (auth.uid() = id);

    CREATE POLICY "user_profiles_update_admin" ON user_profiles
      FOR UPDATE USING (
        auth.uid() = id
        OR EXISTS (
          SELECT 1 FROM user_profiles
          WHERE id = auth.uid() AND role = 'admin'
        )
      );

    RAISE NOTICE 'user_profiles: RLS 활성화 및 정책 적용 완료';
  ELSE
    RAISE NOTICE 'user_profiles: 테이블이 존재하지 않음 - 스킵';
  END IF;
END $$;


-- ============================================
-- 3. development_costs 테이블 RLS
-- ============================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'development_costs') THEN
    ALTER TABLE development_costs ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "development_costs_select_authenticated" ON development_costs;
    DROP POLICY IF EXISTS "development_costs_insert_authenticated" ON development_costs;
    DROP POLICY IF EXISTS "development_costs_update_authenticated" ON development_costs;
    DROP POLICY IF EXISTS "development_costs_delete_authenticated" ON development_costs;

    -- 인증된 사용자만 CRUD 가능
    CREATE POLICY "development_costs_select_authenticated" ON development_costs
      FOR SELECT USING (auth.uid() IS NOT NULL);

    CREATE POLICY "development_costs_insert_authenticated" ON development_costs
      FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

    CREATE POLICY "development_costs_update_authenticated" ON development_costs
      FOR UPDATE USING (auth.uid() IS NOT NULL);

    CREATE POLICY "development_costs_delete_authenticated" ON development_costs
      FOR DELETE USING (auth.uid() IS NOT NULL);

    RAISE NOTICE 'development_costs: RLS 활성화 및 정책 적용 완료';
  ELSE
    RAISE NOTICE 'development_costs: 테이블이 존재하지 않음 - 스킵';
  END IF;
END $$;


-- ============================================
-- 4. price_master 테이블 RLS
-- ============================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'price_master') THEN
    ALTER TABLE price_master ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "price_master_select_authenticated" ON price_master;
    DROP POLICY IF EXISTS "price_master_insert_authenticated" ON price_master;
    DROP POLICY IF EXISTS "price_master_update_authenticated" ON price_master;
    DROP POLICY IF EXISTS "price_master_delete_authenticated" ON price_master;

    -- 인증된 사용자만 CRUD 가능
    CREATE POLICY "price_master_select_authenticated" ON price_master
      FOR SELECT USING (auth.uid() IS NOT NULL);

    CREATE POLICY "price_master_insert_authenticated" ON price_master
      FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

    CREATE POLICY "price_master_update_authenticated" ON price_master
      FOR UPDATE USING (auth.uid() IS NOT NULL);

    CREATE POLICY "price_master_delete_authenticated" ON price_master
      FOR DELETE USING (auth.uid() IS NOT NULL);

    RAISE NOTICE 'price_master: RLS 활성화 및 정책 적용 완료';
  ELSE
    RAISE NOTICE 'price_master: 테이블이 존재하지 않음 - 스킵';
  END IF;
END $$;


-- ============================================
-- 5. settings 테이블 RLS
-- ============================================

DO $$
DECLARE
  profile_table TEXT;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'settings') THEN
    ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "settings_select_authenticated" ON settings;
    DROP POLICY IF EXISTS "settings_insert_admin" ON settings;
    DROP POLICY IF EXISTS "settings_update_admin" ON settings;

    -- 실제 존재하는 프로필 테이블명 감지
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_profiles') THEN
      profile_table := 'user_profiles';
    ELSIF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
      profile_table := 'profiles';
    ELSE
      profile_table := NULL;
    END IF;

    -- 모든 인증된 사용자 조회 가능
    CREATE POLICY "settings_select_authenticated" ON settings
      FOR SELECT USING (auth.uid() IS NOT NULL);

    IF profile_table IS NOT NULL THEN
      -- 프로필 테이블이 있으면 관리자만 생성/수정
      EXECUTE format(
        'CREATE POLICY "settings_insert_admin" ON settings
          FOR INSERT WITH CHECK (
            EXISTS (SELECT 1 FROM %I WHERE id = auth.uid() AND role = %L)
          )',
        profile_table, 'admin'
      );

      EXECUTE format(
        'CREATE POLICY "settings_update_admin" ON settings
          FOR UPDATE USING (
            EXISTS (SELECT 1 FROM %I WHERE id = auth.uid() AND role = %L)
          )',
        profile_table, 'admin'
      );

      RAISE NOTICE 'settings: RLS 활성화 + 관리자 정책 적용 (테이블: %)', profile_table;
    ELSE
      -- 프로필 테이블이 없으면 인증된 사용자 전체 허용
      CREATE POLICY "settings_insert_admin" ON settings
        FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

      CREATE POLICY "settings_update_admin" ON settings
        FOR UPDATE USING (auth.uid() IS NOT NULL);

      RAISE NOTICE 'settings: RLS 활성화 + 인증 사용자 정책 적용 (프로필 테이블 없음)';
    END IF;
  ELSE
    RAISE NOTICE 'settings: 테이블이 존재하지 않음 - 스킵';
  END IF;
END $$;


-- ============================================
-- 6. 함수 search_path 보안 설정
-- ============================================
-- search_path가 설정되지 않은 함수는 악의적 스키마 주입에 취약합니다.
-- 모든 public 함수에 search_path = '' 를 설정합니다.

-- 6a. 모든 public 함수의 search_path를 자동으로 수정
DO $$
DECLARE
  func_record RECORD;
  alter_sql TEXT;
BEGIN
  FOR func_record IN
    SELECT
      n.nspname AS schema_name,
      p.proname AS func_name,
      pg_catalog.pg_get_function_identity_arguments(p.oid) AS func_args
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind IN ('f', 'p')  -- 함수와 프로시저 모두
      -- search_path가 이미 빈 문자열이 아닌 것만
      AND NOT (p.proconfig IS NOT NULL AND p.proconfig::text LIKE '%search_path=%')
  LOOP
    alter_sql := format(
      'ALTER FUNCTION public.%I(%s) SET search_path = %L',
      func_record.func_name,
      func_record.func_args,
      ''
    );
    BEGIN
      EXECUTE alter_sql;
      RAISE NOTICE 'search_path 설정: public.%(%)', func_record.func_name, func_record.func_args;
    EXCEPTION WHEN OTHERS THEN
      -- 프로시저인 경우 ALTER PROCEDURE로 재시도
      BEGIN
        alter_sql := format(
          'ALTER PROCEDURE public.%I(%s) SET search_path = %L',
          func_record.func_name,
          func_record.func_args,
          ''
        );
        EXECUTE alter_sql;
        RAISE NOTICE 'search_path 설정 (procedure): public.%(%)', func_record.func_name, func_record.func_args;
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'search_path 설정 실패: public.%(%) - %', func_record.func_name, func_record.func_args, SQLERRM;
      END;
    END;
  END LOOP;
END $$;

-- 6b. handle_new_user 트리거 함수 (Supabase에서 흔히 사용)
-- 이 함수가 있다면 search_path를 명시적으로 설정
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'handle_new_user'
  ) THEN
    ALTER FUNCTION public.handle_new_user() SET search_path = '';
    RAISE NOTICE 'handle_new_user: search_path 설정 완료';
  END IF;
END $$;


-- ============================================
-- 검증: 현재 RLS 상태 확인
-- ============================================
SELECT
  schemaname,
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- 검증: 정책 목록 확인
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 검증: search_path 미설정 함수 확인 (결과가 비어야 정상)
SELECT
  n.nspname AS schema,
  p.proname AS function_name,
  p.proconfig
FROM pg_catalog.pg_proc p
JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND (p.proconfig IS NULL OR NOT (p.proconfig::text LIKE '%search_path=%'));
