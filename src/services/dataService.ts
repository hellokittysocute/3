import { DashboardItem, Status } from '../types';

// 매출 계산 헬퍼: 단가 × 미납잔량
export function getRevenue(item: DashboardItem): number {
  return item.unitPrice * item.remainingQuantity;
}

// 품목명에서 대표 이름 추출 (용량/호수/괄호 등 제거)
export function extractProductName(itemName: string): string {
  let name = itemName;
  // 앞쪽 괄호 접두어 제거 (예: "(비건)")
  name = name.replace(/^\([^)]*\)/, '');
  // 용량/호수 이후 제거
  name = name.split(/\d+ML|\d+G|\d+호|#\d+|#/i)[0];
  // 괄호 내용 제거
  name = name.replace(/[\(\[].*/, '');
  return name.trim() || itemName.slice(0, 30);
}

export interface ProductGroup {
  name: string;
  count: number;
  items: DashboardItem[];
}

export interface CustomerMaterialData {
  customerCode: string;
  customerName: string;
  totalCount: number;
  products: ProductGroup[];
}

// 자재조정필요 품목을 고객사별 → 대표 품목별로 그룹핑
export function getMaterialByCustomer(items: DashboardItem[]): CustomerMaterialData[] {
  const materialItems = items.filter(i => i.managementType === '자재조정필요');

  const byCustomer = new Map<string, DashboardItem[]>();
  for (const item of materialItems) {
    const code = item.customerCode;
    if (!byCustomer.has(code)) byCustomer.set(code, []);
    byCustomer.get(code)!.push(item);
  }

  const result: CustomerMaterialData[] = [];
  for (const [code, cItems] of byCustomer) {
    const productMap = new Map<string, DashboardItem[]>();
    for (const item of cItems) {
      const pname = extractProductName(item.itemName);
      if (!productMap.has(pname)) productMap.set(pname, []);
      productMap.get(pname)!.push(item);
    }

    const products: ProductGroup[] = [...productMap.entries()]
      .map(([name, pitems]) => ({ name, count: pitems.length, items: pitems }))
      .sort((a, b) => b.count - a.count);

    result.push({
      customerCode: code,
      customerName: cItems[0].customerName,
      totalCount: cItems.length,
      products,
    });
  }

  return result.sort((a, b) => b.totalCount - a.totalCount);
}

export function calculateStats(items: DashboardItem[], editData?: Record<string, any>): {
  overall: any;
  priority: any;
  material: any;
} {
  const getStatus = (item: DashboardItem): Status => {
    const edited = editData?.[item.id]?.revenuePossible;
    if (edited === '가능' || edited === '확인중' || edited === '불가능') return edited;
    return item.status;
  };

  const getStats = (filteredItems: DashboardItem[]) => {
    const totalRevenue = filteredItems.reduce((sum, item) => sum + getRevenue(item), 0);
    const possible = filteredItems.filter(i => getStatus(i) === '가능');
    const checking = filteredItems.filter(i => getStatus(i) === '확인중');
    const impossible = filteredItems.filter(i => getStatus(i) === '불가능');

    // 가능: 단가 × 매출가능수량
    const possibleRevenue = possible.reduce((sum, item) => {
      const qty = editData?.[item.id]?.revenuePossibleQuantity || 0;
      return sum + item.unitPrice * qty;
    }, 0);
    // 확인중: 단가 × 미납잔량
    const checkingRevenue = checking.reduce((sum, item) => sum + getRevenue(item), 0);
    // 불가능: 불가능 품목(단가 × 미납잔량) + 가능 품목 중 매출가능수량 미달분(단가 × (미납잔량 - 매출가능수량))
    const impossibleRevenue = impossible.reduce((sum, item) => sum + getRevenue(item), 0)
      + possible.reduce((sum, item) => {
        const qty = editData?.[item.id]?.revenuePossibleQuantity || 0;
        return sum + item.unitPrice * (item.remainingQuantity - qty);
      }, 0);

    return {
      totalRevenue,
      totalCount: filteredItems.length,
      possibleRevenue,
      possibleCount: possible.length,
      checkingRevenue,
      checkingCount: checking.length,
      impossibleRevenue,
      impossibleCount: impossible.length,
      progressRate: totalRevenue > 0 ? (possibleRevenue / totalRevenue) * 100 : 0
    };
  };

  return {
    overall: getStats(items),
    priority: getStats(items.filter(i => i.managementType === '중점관리품목')),
    material: getStats(items.filter(i => i.managementType === '자재조정필요'))
  };
}
