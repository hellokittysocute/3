/**
 * Supabase → 사내 PostgreSQL 데이터 마이그레이션 스크립트
 *
 * 사용법:
 *   npx tsx scripts/migrate-to-inhouse.ts
 *
 * 사전 조건:
 *   1. 사내 DB에 scripts/create-tables.sql 실행 완료
 *   2. .env.local에 Supabase 접속정보 존재
 */

import { createClient } from '@supabase/supabase-js';
import pg from 'pg';

// ── Supabase (소스) — 마이그레이션 완료, 더 이상 사용하지 않음 ──
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_KEY || '';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── 사내 PostgreSQL (대상) ──
const pool = new pg.Pool({
  host: process.env.DB_HOST || 'cip001.cosmaxhub.com',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'Postgres',
  user: process.env.DB_USER || 'app_mktdashboard_prd',
  password: process.env.DB_PASSWORD || '',
  ssl: false,
});

const SCHEMA = 'app_mktdashboard_prd';

async function migrateTable(tableName: string, primaryKey: string = 'id') {
  console.log(`\n── ${tableName} 마이그레이션 시작 ──`);

  // Supabase에서 전체 데이터 조회
  const { data, error } = await supabase.from(tableName).select('*');
  if (error) {
    console.error(`  [오류] ${tableName} 조회 실패:`, error.message);
    return;
  }
  if (!data || data.length === 0) {
    console.log(`  [스킵] ${tableName}: 데이터 없음`);
    return;
  }

  console.log(`  조회: ${data.length}건`);

  // 컬럼 목록 (첫 번째 행 기준)
  const columns = Object.keys(data[0]);

  // 배치 upsert
  const batchSize = 100;
  let inserted = 0;

  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize);
    const values: unknown[] = [];
    const placeholders: string[] = [];

    batch.forEach((row, batchIdx) => {
      const rowPlaceholders: string[] = [];
      columns.forEach((col, colIdx) => {
        const paramIdx = batchIdx * columns.length + colIdx + 1;
        rowPlaceholders.push(`$${paramIdx}`);
        const val = row[col];
        // JSONB 필드는 stringify
        values.push(typeof val === 'object' && val !== null ? JSON.stringify(val) : val);
      });
      placeholders.push(`(${rowPlaceholders.join(', ')})`);
    });

    const colList = columns.map(c => `"${c}"`).join(', ');
    const updateSet = columns
      .filter(c => c !== primaryKey)
      .map(c => `"${c}" = EXCLUDED."${c}"`)
      .join(', ');

    const query = `
      INSERT INTO ${SCHEMA}.${tableName} (${colList})
      VALUES ${placeholders.join(', ')}
      ON CONFLICT ("${primaryKey}") DO UPDATE SET ${updateSet}
    `;

    await pool.query(query, values);
    inserted += batch.length;
    process.stdout.write(`\r  진행: ${inserted}/${data.length}`);
  }

  console.log(`\n  완료: ${inserted}건 이관`);
}

async function main() {
  console.log('=== Supabase → 사내 PostgreSQL 마이그레이션 ===\n');

  // 연결 테스트
  try {
    const res = await pool.query('SELECT NOW()');
    console.log('사내 DB 연결 성공:', res.rows[0].now);
  } catch (err: any) {
    console.error('사내 DB 연결 실패:', err.message);
    process.exit(1);
  }

  // search_path 설정
  await pool.query(`SET search_path TO ${SCHEMA}`);

  // 테이블별 마이그레이션
  await migrateTable('dashboard_items', 'id');
  await migrateTable('edit_data', 'item_id');
  await migrateTable('all_items', 'id');
  await migrateTable('all_items_edit_data', 'item_id');
  await migrateTable('settings', 'key');
  await migrateTable('monthly_snapshots', 'id');
  await migrateTable('user_profiles', 'id');

  console.log('\n=== 마이그레이션 완료 ===');
  await pool.end();
}

main().catch(err => {
  console.error('마이그레이션 실패:', err);
  process.exit(1);
});
