export type Status = '가능' | '불가능' | '확인중';
export type ManagementType = '중점관리품목' | '자재조정필요';

export interface DashboardItem {
  id: string;
  cisManager: string;
  category: string;
  customerCode: string;
  customerName: string;
  teamName: string;
  salesManager: string;
  createdDate: string;
  originalDueDate: string;
  changedDueDate: string;
  dueMonth: number;
  materialCode: string; // M열 (자재)
  itemName: string; // N열 (내역)
  totalQuantity: number; // O열 (총본품수량)
  orderQuantity: number; // P열 (총오더수량)
  deliveredQuantity: number; // Q열 (납품수량)
  remainingQuantity: number; // R열 (미납잔량)
  materialSource: string;
  productionRequestDate: string;
  materialStatus: string; // V열 (자재 1차)
  week1: string;
  week2: string;
  week3: string;
  delayDays: number;
  mfg1: string;
  mfgFinal: string;
  pkg1: string;
  pkgFinal: string;
  productionSite: string;
  leadTime: string;
  status: Status; // AF열
  progressRate: string;
  delayReason: string;
  content: string;
  managementType: ManagementType;
  unitPrice: number;
  revenue: number;
}

export interface SummaryStats {
  totalRevenue: number;
  totalCount: number;
  possibleRevenue: number;
  possibleCount: number;
  checkingRevenue: number;
  checkingCount: number;
  impossibleRevenue: number;
  impossibleCount: number;
  progressRate: number;
}
