export type Status = '가능' | '불가능' | '확인중';
export type ManagementType = '중점관리품목' | '자재조정필요';

export interface DashboardItem {
  id: string;
  cisManager: string;           // [1] CIS담당
  category: string;             // [2] 중분류명
  customerCode: string;         // [3] 고객약호
  customerName: string;         // [4] 판매처이름
  teamName: string;             // [5] 영업팀명
  salesManager: string;         // [6] 영업담당자명
  createdDate: string;          // [7] 생성일
  originalDueDate: string;      // [8] 원납기일
  orderLeadTime: number;        // [9] 발주리드타임
  changedDueDate: string;       // [10] 변경납기일
  dueMonth: number;             // [11] 변경납기월
  materialCode: string;         // [12] 자재
  itemName: string;             // [13] 내역
  totalQuantity: number;        // [14] 총본품수량
  orderQuantity: number;        // [15] 총오더수량
  deliveredQuantity: number;    // [16] 납품수량
  remainingQuantity: number;    // [17] 미납잔량
  materialSource: string;       // [18] 부자재 자급/사급
  productionRequestDate: string;// [19] 생산완료 요청일
  materialStatus: string;       // [20] 자재 1차
  week1: string;                // [21] 1주차
  week2: string;                // [22] 2주차
  week3: string;                // [23] 3주차
  delayDays: number;            // [24] 부자재 지연일수
  mfg1: string;                 // [25] 제조 1차
  mfgFinal: string;             // [26] 제조 최종
  pkg1: string;                 // [27] 충포장 1차
  pkgFinal: string;             // [28] 충포장 최종
  productionSite: string;       // [29] 생산처
  leadTime: string;             // [30] 생산리드타임
  status: Status;               // [31] 3월 매출 가능여부
  progressRate: string;         // [32] 진도율
  delayReason: string;          // [33] 지연사유
  managementType: ManagementType; // [34] 내용 (관리구분)
  managementNote: string;       // [35] 중점관리사항
  unitPrice: number;            // [36] 단가
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
