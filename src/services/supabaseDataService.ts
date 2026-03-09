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
    revenuePossible: (row.revenue_possible as '가능' | '확인중' | '불가능' | '') || '',
    revenuePossibleQuantity: Number(row.revenue_possible_quantity) || 0,
    delayReason: (row.delay_reason as string) || '',
    importance: (row.importance as '상' | '중' | '하' | '') || '',
    productionSite: (row.production_site as string) || '',
    purchaseManager: (row.purchase_manager as string) || '',
    note: (row.note as string) || '',
  };
}

// ── 전체 대시보드 아이템 조회 (CSV 파싱 대체) ──
export async function fetchDashboardItems(): Promise<DashboardItem[]> {
  const { data, error } = await supabase
    .from('dashboard_items')
    .select('*')
    .order('id');

  if (error) {
    console.error('dashboard_items 조회 오류:', error.message);
    return [];
  }

  return (data || []).map(rowToItem);
}

// ── 전체 편집 데이터 조회 (GET /api/edit-data 대체) ──
export async function fetchAllEditData(): Promise<Record<string, EditableData>> {
  const { data, error } = await supabase
    .from('edit_data')
    .select('*');

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

// ── 단일 아이템 편집 데이터 업데이트 (PUT /api/edit-data/:id 대체) ──
export async function updateEditData(itemId: string, editableData: EditableData): Promise<void> {
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
      production_site: editableData.productionSite,
      purchase_manager: editableData.purchaseManager,
      note: editableData.note,
      updated_at: new Date().toISOString(),
    });

  if (error) {
    console.error('edit_data 업데이트 오류:', error.message);
  }
}

// ── 전체 편집 데이터 저장 (POST /api/edit-data/save-all 대체) ──
export async function saveAllEditData(allData: Record<string, EditableData>): Promise<void> {
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
    production_site: d.productionSite,
    purchase_manager: d.purchaseManager,
    note: d.note,
    updated_at: new Date().toISOString(),
  }));

  // 100개씩 batch upsert
  for (let i = 0; i < rows.length; i += 100) {
    const batch = rows.slice(i, i + 100);
    const { error } = await supabase.from('edit_data').upsert(batch);
    if (error) {
      console.error(`edit_data 일괄 저장 오류 (${i}-${i + batch.length}):`, error.message);
    }
  }
}
