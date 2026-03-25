import { supabase } from '../lib/supabase';
import { DashboardItem, EditableData, Status, ManagementType, SnapshotMeta, SnapshotRow } from '../types';

// ── DB row → DashboardItem 변환 ──
function rowToItem(row: Record<string, unknown>): DashboardItem {
  const status = row.status as string;
  const validStatuses: Status[] = ['가능', '불가능', '확인중'];
  const parsedStatus: Status = validStatuses.includes(status as Status) ? (status as Status) : '확인중';

  const mgmt = row.management_type as string;
  const parsedMgmt: ManagementType = mgmt === '자재조정필요' ? '자재조정필요' : '중점관리품목';

  return {
    id: row.id as string,
    cisManager: (row.cis_manager as string) || '',
    category: (row.category as string) || '',
    customerCode: (row.customer_code as string) || '',
    customerName: (row.customer_name as string) || '',
    teamName: (row.team_name as string) || '',
    salesManager: (row.sales_manager as string) || '',
    createdDate: (row.created_date as string) || '',
    originalDueDate: (row.original_due_date as string) || '',
    orderLeadTime: Number(row.order_lead_time) || 0,
    changedDueDate: (row.changed_due_date as string) || '',
    dueMonth: Number(row.due_month) || 3,
    materialCode: (row.material_code as string) || '',
    itemName: (row.item_name as string) || '',
    totalQuantity: Number(row.total_quantity) || 0,
    orderQuantity: Number(row.order_quantity) || 0,
    deliveredQuantity: Number(row.delivered_quantity) || 0,
    remainingQuantity: Number(row.remaining_quantity) || 0,
    materialSource: (row.material_source as string) || '',
    productionRequestDate: (row.production_request_date as string) || '',
    materialStatus: (row.material_status as string) || '',
    week1: (row.week1 as string) || '',
    week2: (row.week2 as string) || '',
    week3: (row.week3 as string) || '',
    delayDays: Number(row.delay_days) || 0,
    productionRequestYn: (row.production_request_yn as string) || '',
    mfg1: (row.mfg1 as string) || '',
    mfgFinal: (row.mfg_final as string) || '',
    pkg1: (row.pkg1 as string) || '',
    pkgFinal: (row.pkg_final as string) || '',
    productionSite: (row.production_site as string) || '',
    leadTime: (row.lead_time as string) || '',
    status: parsedStatus,
    progressRate: (row.progress_rate as string) || '',
    delayReason: (row.delay_reason as string) || '',
    managementType: parsedMgmt,
    managementNote: (row.management_note as string) || '',
    unitPrice: Number(row.unit_price) || 0,
    salesDocument: (row.sales_document as string) || '',
    originalOrderQuantity: Number(row.original_order_quantity) || 0,
  };
}

// ── "2026-04-10 00:00:00" → "4/10" 변환 ──
function toShortDate(s: string): string {
  if (!s) return '';
  const v = s.trim();
  // 이미 m/d 형식이면 그대로
  if (/^\~?\d{1,2}\/\d{1,2}$/.test(v)) return v;
  // ISO/timestamp 형식 파싱
  const d = new Date(v);
  if (!isNaN(d.getTime())) return `${d.getMonth() + 1}/${d.getDate()}`;
  return v;
}

// ── DB row → EditableData 변환 ──
function rowToEditData(row: Record<string, unknown>): EditableData {
  return {
    writeDate: (row.write_date as string) || '',
    productionCompleteDate: toShortDate((row.production_complete_date as string) || ''),
    materialSettingDate: toShortDate((row.material_setting_date as string) || ''),
    manufacturingDate: toShortDate((row.manufacturing_date as string) || ''),
    packagingDate: toShortDate((row.packaging_date as string) || ''),
    materialSettingFilledAt: (row.material_setting_filled_at as string) || '',
    manufacturingFilledAt: (row.manufacturing_filled_at as string) || '',
    packagingFilledAt: (row.packaging_filled_at as string) || '',
    revenuePossibleFilledAt: (row.revenue_possible_filled_at as string) || '',
    revenuePossible: (row.revenue_possible as '가능' | '확인중' | '불가능' | '') || '확인중',
    revenuePossibleQuantity: row.revenue_possible_quantity != null ? Number(row.revenue_possible_quantity) : 0,
    delayReason: (row.delay_reason as string) || '',
    revenueReflected: (row.revenue_reflected as 'O' | 'X' | '') || '',
    importance: (row.importance as '상' | '중' | '하' | '') || '',
    productionSite: (row.production_site as string) || '',
    purchaseManager: (row.purchase_manager as string) || '',
    note: (row.note as string) || '',
  };
}

// ── 가용 월 목록 조회 (ID prefix 기반) ──
export async function fetchAvailableMonths(): Promise<string[]> {
  const { data, error } = await supabase
    .from('dashboard_items')
    .select('id')
    .neq('customer_code', '');

  if (error || !data) return ['2026-03'];

  const months = new Set<string>();
  data.forEach((row: { id: string }) => {
    // 2026-04-item-0 → 2026-04, item-0 → 2026-03
    const match = row.id.match(/^(\d{4}-\d{2})-item-/);
    if (match) {
      months.add(match[1]);
    } else if (row.id.startsWith('item-')) {
      months.add('2026-03');
    }
  });

  const sorted = [...months].sort();
  return sorted.length > 0 ? sorted : ['2026-03'];
}

// ── 월별 대시보드 아이템 조회 ──
export async function fetchDashboardItems(month?: string): Promise<DashboardItem[]> {
  const { data, error } = await supabase
    .from('dashboard_items')
    .select('*')
    .neq('customer_code', '')
    .order('id');

  if (error) {
    console.error('dashboard_items 조회 오류:', error.message);
    return [];
  }

  const items = (data || []).map(rowToItem);

  // 클라이언트에서 월별 필터링 (ID prefix 기반)
  if (month && month !== '2026-03') {
    const prefix = `${month}-`;
    return items.filter(item => item.id.startsWith(prefix));
  } else if (month === '2026-03') {
    // 3월은 prefix 없는 item-* 형태
    return items.filter(item => !item.id.includes('-item-') || item.id.startsWith('item-'));
  }
  return items;
}

// ── 월별 편집 데이터 조회 ──
export async function fetchAllEditData(month?: string): Promise<Record<string, EditableData>> {
  const { data, error } = await supabase.from('edit_data').select('*');

  if (error) {
    console.error('edit_data 조회 오류:', error.message);
    return {};
  }

  const result: Record<string, EditableData> = {};
  (data || []).forEach((row: Record<string, unknown>) => {
    const itemId = row.item_id as string;

    // 클라이언트에서 월별 필터링
    if (month && month !== '2026-03') {
      if (!itemId.startsWith(`${month}-`)) return;
    } else if (month === '2026-03') {
      if (itemId.includes('-item-') && !itemId.startsWith('item-')) return;
    }

    result[itemId] = rowToEditData(row);
  });
  return result;
}

// ── 단일 아이템 편집 데이터 업데이트 ──
export async function updateEditData(itemId: string, editableData: EditableData, month?: string): Promise<void> {
  const { error } = await supabase
    .from('edit_data')
    .upsert({
      item_id: itemId,
      write_date: editableData.writeDate,
      production_complete_date: editableData.productionCompleteDate,
      material_setting_date: editableData.materialSettingDate,
      manufacturing_date: editableData.manufacturingDate,
      packaging_date: editableData.packagingDate,
      material_setting_filled_at: editableData.materialSettingFilledAt,
      manufacturing_filled_at: editableData.manufacturingFilledAt,
      packaging_filled_at: editableData.packagingFilledAt,
      revenue_possible: editableData.revenuePossible,
      revenue_possible_quantity: editableData.revenuePossibleQuantity,
      delay_reason: editableData.delayReason,
      revenue_reflected: editableData.revenueReflected,
      importance: editableData.importance,
      purchase_manager: editableData.purchaseManager,
      note: editableData.note,
      updated_at: new Date().toISOString(),
    });

  if (error) {
    console.error('edit_data 업데이트 오류:', error.message);
  }
}

// ── 설정값 조회 (settings 테이블) ──
export interface SalesSettings {
  salesTarget: number;       // 매출 목표 (예: 48000000000 = 480억)
  normalRevenue: number;     // 정상매출 (예: 116000000000 = 1,160억)
  additionalRevenue: number; // 추가매출 (예: 4000000000 = 40억)
}

const DEFAULT_SETTINGS: SalesSettings = {
  salesTarget: 48000000000,
  normalRevenue: 116000000000,
  additionalRevenue: 4000000000,
};

export async function fetchSalesSettings(month?: string): Promise<SalesSettings> {
  const prefix = month ? `${month}_` : '';
  const { data, error } = await supabase
    .from('settings')
    .select('key, value')
    .in('key', [`${prefix}sales_target`, `${prefix}normal_revenue`, `${prefix}additional_revenue`]);

  if (error) {
    console.error('settings 조회 오류:', error.message);
    return DEFAULT_SETTINGS;
  }

  const map = new Map((data || []).map((r: any) => [r.key, r.value]));
  // 월별 키가 없으면 기본 키로 fallback
  const getVal = (key: string, fallback: number) => {
    return Number(map.get(`${prefix}${key}`)) || fallback;
  };

  return {
    salesTarget: getVal('sales_target', DEFAULT_SETTINGS.salesTarget),
    normalRevenue: getVal('normal_revenue', DEFAULT_SETTINGS.normalRevenue),
    additionalRevenue: getVal('additional_revenue', DEFAULT_SETTINGS.additionalRevenue),
  };
}

export async function updateSalesSetting(key: string, value: number): Promise<void> {
  const { error } = await supabase
    .from('settings')
    .upsert({ key, value: value.toString(), updated_at: new Date().toISOString() });

  if (error) {
    console.error('settings 업데이트 오류:', error.message);
  }
}

// ── 전체 편집 데이터 저장 ──
export async function saveAllEditData(allData: Record<string, EditableData>, month?: string): Promise<void> {
  const rows = Object.entries(allData).map(([itemId, d]) => ({
    item_id: itemId,
    write_date: d.writeDate,
    production_complete_date: d.productionCompleteDate,
    material_setting_date: d.materialSettingDate,
    manufacturing_date: d.manufacturingDate,
    packaging_date: d.packagingDate,
    material_setting_filled_at: d.materialSettingFilledAt,
    manufacturing_filled_at: d.manufacturingFilledAt,
    packaging_filled_at: d.packagingFilledAt,
    revenue_possible: d.revenuePossible,
    revenue_possible_quantity: d.revenuePossibleQuantity,
    delay_reason: d.delayReason,
    revenue_reflected: d.revenueReflected,
    importance: d.importance,
    purchase_manager: d.purchaseManager,
    note: d.note,
    updated_at: new Date().toISOString(),
  }));

  // 100개씩 batch upsert
  for (let i = 0; i < rows.length; i += 100) {
    const batch = rows.slice(i, i + 100);
    const { error } = await supabase.from('edit_data').upsert(batch);
    if (error) {
      throw new Error(`edit_data 일괄 저장 오류 (${i}-${i + batch.length}): ${error.message}`);
    }
  }
}

// ── 스냅샷 관련 ──

/** 스냅샷 생성: 현재 dashboard_items + edit_data를 JSONB로 저장 */
export async function createSnapshot(
  month: string,
  label: string,
  items: DashboardItem[],
  editData: Record<string, EditableData>,
  createdBy: string,
): Promise<{ id: number } | null> {
  const data: SnapshotRow[] = items.map(item => ({
    item,
    edit: editData[item.id] || {
      writeDate: '', productionCompleteDate: '', materialSettingDate: '', manufacturingDate: '',
      packagingDate: '', materialSettingFilledAt: '', manufacturingFilledAt: '', packagingFilledAt: '',
      revenuePossible: '확인중' as const, revenuePossibleQuantity: 0, revenuePossibleFilledAt: '',
      delayReason: '', revenueReflected: '' as const, importance: '' as const, productionSite: '', purchaseManager: '', note: '',
    },
  }));

  const totalRevenue = items.reduce((s, i) => {
    const ed = editData[i.id];
    const qty = ed?.revenuePossibleQuantity || 0;
    return s + qty * i.unitPrice;
  }, 0);

  const { data: result, error } = await supabase
    .from('monthly_snapshots')
    .insert({
      month,
      label,
      created_by: createdBy,
      item_count: items.length,
      total_revenue: totalRevenue,
      data,
    })
    .select('id')
    .single();

  if (error) {
    console.error('스냅샷 생성 오류:', error.message, error.details, error.hint);
    throw new Error(error.message);
  }
  return result;
}

/** 스냅샷 목록 조회 (data 제외, 메타만) */
export async function fetchSnapshots(): Promise<SnapshotMeta[]> {
  const { data, error } = await supabase
    .from('monthly_snapshots')
    .select('id, month, label, created_at, created_by, item_count, total_revenue')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('스냅샷 목록 조회 오류:', error.message);
    return [];
  }
  return (data || []) as SnapshotMeta[];
}

/** 스냅샷 상세 데이터 조회 */
export async function fetchSnapshotData(id: number): Promise<SnapshotRow[]> {
  const { data, error } = await supabase
    .from('monthly_snapshots')
    .select('data')
    .eq('id', id)
    .single();

  if (error) {
    console.error('스냅샷 데이터 조회 오류:', error.message);
    return [];
  }
  return (data?.data || []) as SnapshotRow[];
}

/** 스냅샷 삭제 */
export async function deleteSnapshot(id: number): Promise<boolean> {
  const { error } = await supabase
    .from('monthly_snapshots')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('스냅샷 삭제 오류:', error.message);
    return false;
  }
  return true;
}

/** 특정 월의 스냅샷 존재 여부 확인 */
export async function hasSnapshotForMonth(month: string): Promise<boolean> {
  const { count, error } = await supabase
    .from('monthly_snapshots')
    .select('id', { count: 'exact', head: true })
    .eq('month', month);

  if (error) return false;
  return (count || 0) > 0;
}
