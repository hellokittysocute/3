import { DashboardItem, Status, ManagementType } from '../types';

// Robust CSV parser to handle quotes and commas within values
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

// 숫자 문자열에서 콤마 제거 후 파싱 (예: "400,000" -> 400000)
function parseNum(val: string | undefined): number {
  if (!val) return 0;
  const cleaned = val.replace(/,/g, '').replace(/-/g, '');
  return parseFloat(cleaned) || 0;
}

export function parseDashboardData(csvText: string): DashboardItem[] {
  // BOM 제거
  const cleaned = csvText.replace(/^\uFEFF/, '');
  const lines = cleaned.split(/\r?\n/);

  // 처음 5줄은 요약/헤더 행이므로 스킵, 빈 줄 제외
  const dataLines = lines.slice(5).filter(line => {
    const cols = parseCSVLine(line);
    return cols[3] && cols[3].trim() !== '';
  });

  return dataLines.map((line, index) => {
    const cols = parseCSVLine(line);

    const status = (cols[31] || '').trim();
    const validStatuses: Status[] = ['가능', '불가능', '확인중'];
    const parsedStatus: Status = validStatuses.includes(status as Status) ? (status as Status) : '확인중';

    const mgmtType = (cols[34] || '').trim();
    const parsedMgmt: ManagementType = mgmtType === '자재조정필요' ? '자재조정필요' : '중점관리품목';

    const unitPrice = parseNum(cols[36]);
    const remainingQuantity = parseNum(cols[17]);

    return {
      id: `item-${index}`,
      cisManager: cols[1] || '',
      category: cols[2] || '',
      customerCode: cols[3] || '',
      customerName: cols[4] || '',
      teamName: cols[5] || '',
      salesManager: cols[6] || '',
      createdDate: cols[7] || '',
      originalDueDate: cols[8] || '',
      orderLeadTime: parseNum(cols[9]),
      changedDueDate: cols[10] || '',
      dueMonth: parseInt(cols[11]) || 3,
      materialCode: cols[12] || '',
      itemName: cols[13] || '',
      totalQuantity: parseNum(cols[14]),
      orderQuantity: parseNum(cols[15]),
      deliveredQuantity: parseNum(cols[16]),
      remainingQuantity,
      materialSource: cols[18] || '',
      productionRequestDate: cols[19] || '',
      materialStatus: cols[20] || '',
      week1: cols[21] || '',
      week2: cols[22] || '',
      week3: cols[23] || '',
      delayDays: parseNum(cols[24]),
      mfg1: cols[25] || '',
      mfgFinal: cols[26] || '',
      pkg1: cols[27] || '',
      pkgFinal: cols[28] || '',
      productionSite: cols[29] || '',
      leadTime: cols[30] || '',
      status: parsedStatus,
      progressRate: cols[32] || '',
      delayReason: cols[33] || '',
      managementType: parsedMgmt,
      managementNote: cols[35] || '',
      unitPrice,
      salesDocument: cols[12] || '',
      originalOrderQuantity: parseNum(cols[15]),
    } as DashboardItem;
  });
}

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

export function calculateStats(items: DashboardItem[]): {
  overall: any;
  priority: any;
  material: any;
} {
  const getStats = (filteredItems: DashboardItem[]) => {
    const totalRevenue = filteredItems.reduce((sum, item) => sum + getRevenue(item), 0);
    const possible = filteredItems.filter(i => i.status === '가능');
    const checking = filteredItems.filter(i => i.status === '확인중');
    const impossible = filteredItems.filter(i => i.status === '불가능');

    const possibleRevenue = possible.reduce((sum, item) => sum + getRevenue(item), 0);

    return {
      totalRevenue,
      totalCount: filteredItems.length,
      possibleRevenue,
      possibleCount: possible.length,
      checkingRevenue: checking.reduce((sum, item) => sum + getRevenue(item), 0),
      checkingCount: checking.length,
      impossibleRevenue: impossible.reduce((sum, item) => sum + getRevenue(item), 0),
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
