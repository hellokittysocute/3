import { supabase } from '../lib/supabase';
import { DashboardItem, EditableData, Status, ManagementType } from '../types';

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

// ── DB row → EditableData 변환 ──
function rowToEditData(row: Record<string, unknown>): EditableData {
  return {
    productionCompleteDate: (row.production_complete_date as string) || '',
    materialSettingDate: (row.material_setting_date as string) || '',
    manufacturingDate: (row.manufacturing_date as string) || '',
    packagingDate: (row.packaging_date as string) || '',
    revenuePossible: (row.revenue_possible as '가능' | '확인중' | '불가능' | '') || '확인중',
    revenuePossibleQuantity: Number(row.revenue_possible_quantity) || 0,
    delayReason: (row.delay_reason as string) || '',
    importance: (row.importance as '상' | '중' | '하' | '') || '',
    productionSite: (row.production_site as string) || '',
    purchaseManager: (row.purchase_manager as string) || '',
    note: (row.note as string) || '',
  };
}

// ── 가용 월 목록 조회 ──
export async function fetchAvailableMonths(): Promise<string[]> {
  // PostgREST 캐시가 month 컬럼을 인식할 때까지 기본값 반환
  return ['2026-03'];
}

// ── 월별 대시보드 아이템 조회 ──
export async function fetchDashboardItems(month?: string): Promise<DashboardItem[]> {
  // PostgREST 캐시 이슈로 month 필터 임시 비활성화
  const { data, error } = await supabase
    .from('dashboard_items')
    .select('*')
    .neq('customer_code', '')
    .order('id');

  if (error) {
    console.error('dashboard_items 조회 오류:', error.message);
    return [];
  }

  return (data || []).map(rowToItem);
}

// ── 월별 편집 데이터 조회 ──
export async function fetchAllEditData(month?: string): Promise<Record<string, EditableData>> {
  // PostgREST 캐시 이슈로 month 필터 임시 비활성화
  const { data, error } = await supabase.from('edit_data').select('*');

  if (error) {
    console.error('edit_data 조회 오류:', error.message);
    return {};
  }

  const result: Record<string, EditableData> = {};
  (data || []).forEach((row: Record<string, unknown>) => {
    const itemId = row.item_id as string;
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
      production_complete_date: editableData.productionCompleteDate,
      material_setting_date: editableData.materialSettingDate,
      manufacturing_date: editableData.manufacturingDate,
      packaging_date: editableData.packagingDate,
      revenue_possible: editableData.revenuePossible,
      revenue_possible_quantity: editableData.revenuePossibleQuantity,
      delay_reason: editableData.delayReason,
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
    production_complete_date: d.productionCompleteDate,
    material_setting_date: d.materialSettingDate,
    manufacturing_date: d.manufacturingDate,
    packaging_date: d.packagingDate,
    revenue_possible: d.revenuePossible,
    revenue_possible_quantity: d.revenuePossibleQuantity,
    delay_reason: d.delayReason,
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
