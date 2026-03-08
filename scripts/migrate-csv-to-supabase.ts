import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── 환경 변수 ──
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ SUPABASE_URL 과 SUPABASE_SERVICE_ROLE_KEY 환경 변수를 설정하세요.');
  console.error('예: SUPABASE_URL=https://xxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=eyJ... npx tsx scripts/migrate-csv-to-supabase.ts');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ── CSV 파싱 (dataService.ts 로직 재사용) ──
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function parseNum(val: string | undefined): number {
  if (!val) return 0;
  const cleaned = val.replace(/,/g, '').replace(/-/g, '');
  return parseFloat(cleaned) || 0;
}

async function main() {
  // CSV 파일 읽기
  const csvPath = path.join(__dirname, '..', 'src', 'data', 'raw.csv');
  const csvText = fs.readFileSync(csvPath, 'utf-8').replace(/^\uFEFF/, '');
  const lines = csvText.split(/\r?\n/);

  // 처음 5줄 스킵 (요약/헤더)
  const dataLines = lines.slice(5).filter(line => {
    const cols = parseCSVLine(line);
    return cols[3] && cols[3].trim() !== '';
  });

  console.log(`📊 CSV에서 ${dataLines.length}개 행 파싱 완료`);

  // dashboard_items 데이터 변환
  const dashboardRows = dataLines.map((line, index) => {
    const cols = parseCSVLine(line);

    const status = (cols[31] || '').trim();
    const validStatuses = ['가능', '불가능', '확인중'];
    const parsedStatus = validStatuses.includes(status) ? status : '확인중';

    const mgmtType = (cols[34] || '').trim();
    const parsedMgmt = mgmtType === '자재조정필요' ? '자재조정필요' : '중점관리품목';

    return {
      id: `item-${index}`,
      cis_manager: cols[1] || '',
      category: cols[2] || '',
      customer_code: cols[3] || '',
      customer_name: cols[4] || '',
      team_name: cols[5] || '',
      sales_manager: cols[6] || '',
      created_date: cols[7] || '',
      original_due_date: cols[8] || '',
      order_lead_time: parseNum(cols[9]),
      changed_due_date: cols[10] || '',
      due_month: parseInt(cols[11]) || 3,
      material_code: cols[12] || '',
      item_name: cols[13] || '',
      total_quantity: parseNum(cols[14]),
      order_quantity: parseNum(cols[15]),
      delivered_quantity: parseNum(cols[16]),
      remaining_quantity: parseNum(cols[17]),
      material_source: cols[18] || '',
      production_request_date: cols[19] || '',
      material_status: cols[20] || '',
      week1: cols[21] || '',
      week2: cols[22] || '',
      week3: cols[23] || '',
      delay_days: parseNum(cols[24]),
      mfg1: cols[25] || '',
      mfg_final: cols[26] || '',
      pkg1: cols[27] || '',
      pkg_final: cols[28] || '',
      production_site: cols[29] || '',
      lead_time: cols[30] || '',
      status: parsedStatus,
      progress_rate: cols[32] || '',
      delay_reason: cols[33] || '',
      management_type: parsedMgmt,
      management_note: cols[35] || '',
      unit_price: parseNum(cols[36]),
      sales_document: cols[12] || '',
      original_order_quantity: parseNum(cols[15]),
    };
  });

  // Batch upsert dashboard_items (100개씩)
  console.log('⬆️  dashboard_items 테이블에 업로드 중...');
  for (let i = 0; i < dashboardRows.length; i += 100) {
    const batch = dashboardRows.slice(i, i + 100);
    const { error } = await supabase.from('dashboard_items').upsert(batch);
    if (error) {
      console.error(`❌ dashboard_items 업로드 실패 (행 ${i}-${i + batch.length}):`, error.message);
      process.exit(1);
    }
    console.log(`  ✅ ${i + batch.length}/${dashboardRows.length} 행 완료`);
  }

  // edit_data 빈 행 생성
  console.log('⬆️  edit_data 테이블에 초기 행 생성 중...');
  const editRows = dashboardRows.map(row => ({
    item_id: row.id,
    production_complete_date: '',
    material_setting_date: '',
    manufacturing_date: '',
    packaging_date: '',
    revenue_possible: '',
    revenue_possible_quantity: row.remaining_quantity,
    delay_reason: '',
  }));

  for (let i = 0; i < editRows.length; i += 100) {
    const batch = editRows.slice(i, i + 100);
    const { error } = await supabase.from('edit_data').upsert(batch);
    if (error) {
      console.error(`❌ edit_data 업로드 실패 (행 ${i}-${i + batch.length}):`, error.message);
      process.exit(1);
    }
    console.log(`  ✅ ${i + batch.length}/${editRows.length} 행 완료`);
  }

  console.log('\n🎉 마이그레이션 완료!');
  console.log(`  - dashboard_items: ${dashboardRows.length}행`);
  console.log(`  - edit_data: ${editRows.length}행`);
}

main().catch(err => {
  console.error('❌ 마이그레이션 오류:', err);
  process.exit(1);
});
