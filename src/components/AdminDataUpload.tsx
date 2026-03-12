import React, { useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Upload, FileSpreadsheet, CheckCircle, AlertTriangle, Trash2 } from 'lucide-react';
import { cn } from '../lib/utils';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

interface ParsedRow {
  id: string;
  [key: string]: unknown;
}

// 구분자 자동 감지 (탭 vs 쉼표)
let detectedDelimiter: string | null = null;

function detectDelimiter(text: string): string {
  if (detectedDelimiter) return detectedDelimiter;
  // 첫 10줄에서 탭과 쉼표 수 비교
  const sample = text.split(/\r?\n/).slice(0, 10).join('\n');
  const tabs = (sample.match(/\t/g) || []).length;
  const commas = (sample.match(/,/g) || []).length;
  detectedDelimiter = tabs > commas ? '\t' : ',';
  return detectedDelimiter;
}

function parseCSVLine(line: string, delimiter = ','): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++; // 이스케이프된 따옴표 ("") 처리
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
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

// CSV 헤더명 → DB 컬럼 매핑 (헤더명에 포함된 키워드로 매칭)
const HEADER_MAP: Record<string, { field: string; type: 'string' | 'number' }> = {
  'CIS담당': { field: 'cis_manager', type: 'string' },
  '중분류명': { field: 'category', type: 'string' },
  '고객약호': { field: 'customer_code', type: 'string' },
  '판매처이름': { field: 'customer_name', type: 'string' },
  '영업팀명': { field: 'team_name', type: 'string' },
  '영업담당자명': { field: 'sales_manager', type: 'string' },
  '생성일': { field: 'created_date', type: 'string' },
  '원납기일': { field: 'original_due_date', type: 'string' },
  '발주리드타임': { field: 'order_lead_time', type: 'number' },
  '변경납기': { field: 'changed_due_date', type: 'string' },
  '변경납기일': { field: 'changed_due_date', type: 'string' },
  '변경납기월': { field: 'due_month', type: 'number' },
  '중요도': { field: 'importance', type: 'string' },
  '자재': { field: 'material_code', type: 'string' },
  '내역': { field: 'item_name', type: 'string' },
  '총본품수량': { field: 'total_quantity', type: 'number' },
  '환산수량': { field: 'total_quantity', type: 'number' },
  '총오더수량': { field: 'order_quantity', type: 'number' },
  '납품수량': { field: 'delivered_quantity', type: 'number' },
  '미납잔량': { field: 'remaining_quantity', type: 'number' },
  '부자재 자급/사급': { field: 'material_source', type: 'string' },
  '자급사급': { field: 'material_source', type: 'string' },
  '생산완료 요청일': { field: 'production_request_date', type: 'string' },
  '생산완료요청일': { field: 'production_request_date', type: 'string' },
  '자재 1차': { field: 'material_status', type: 'string' },
  '자재1차': { field: 'material_status', type: 'string' },
  '1주차': { field: 'week1', type: 'string' },
  '2주차': { field: 'week2', type: 'string' },
  '3주차': { field: 'week3', type: 'string' },
  '부자재 지연일수': { field: 'delay_days', type: 'number' },
  '부자재지연일수': { field: 'delay_days', type: 'number' },
  '제조 1차': { field: 'mfg1', type: 'string' },
  '제조1차': { field: 'mfg1', type: 'string' },
  '기존제조': { field: 'mfg1', type: 'string' },
  '현재제조': { field: 'mfg1', type: 'string' },
  '제조 최종': { field: 'mfg_final', type: 'string' },
  '제조최종': { field: 'mfg_final', type: 'string' },
  '충포장 1차': { field: 'pkg1', type: 'string' },
  '충포장1차': { field: 'pkg1', type: 'string' },
  '충포장 최종': { field: 'pkg_final', type: 'string' },
  '충포장최종': { field: 'pkg_final', type: 'string' },
  '생산처': { field: 'production_site', type: 'string' },
  '생산리드타임': { field: 'lead_time', type: 'string' },
  '매출 가능여부': { field: 'status', type: 'string' },
  '매출가능여부': { field: 'status', type: 'string' },
  '진도율': { field: 'progress_rate', type: 'string' },
  '지연사유': { field: 'delay_reason', type: 'string' },
  '관리구분': { field: 'management_type', type: 'string' },
  '내용': { field: 'management_type', type: 'string' },
  '중점관리사항': { field: 'management_note', type: 'string' },
  '단가': { field: 'unit_price', type: 'number' },
  // edit_data 필드 (_ 접두사 → dashboard_items upsert에서 제외)
  '구매담당': { field: '_purchase_manager', type: 'string' },
  '부자재': { field: '_material_setting_date', type: 'string' },
  '제조': { field: '_manufacturing_date', type: 'string' },
  '충포장': { field: '_packaging_date', type: 'string' },
  '매출': { field: '_revenue_possible', type: 'string' },
  '비고': { field: '_note', type: 'string' },
  '파셜여부': { field: '_partial', type: 'string' },
};

function findHeaderMapping(headers: string[]): Map<string, number> {
  const mapping = new Map<string, number>();
  headers.forEach((header, index) => {
    const trimmed = header.trim();
    if (HEADER_MAP[trimmed]) {
      mapping.set(trimmed, index);
    }
  });
  return mapping;
}

function getVal(cols: string[], headerMapping: Map<string, number>, ...headerNames: string[]): string {
  for (const name of headerNames) {
    const idx = headerMapping.get(name);
    if (idx !== undefined && cols[idx]) return cols[idx].trim();
  }
  return '';
}

function getNumVal(cols: string[], headerMapping: Map<string, number>, ...headerNames: string[]): number {
  return parseNum(getVal(cols, headerMapping, ...headerNames));
}

interface ParseResult {
  rows: ParsedRow[];
  unmappedHeaders: string[];
  mappedHeaders: string[];
  headerDebug: string;
}

function parseCSVToRows(csvText: string): ParseResult {
  const cleaned = csvText.replace(/^\uFEFF/, '');
  const lines = cleaned.split(/\r?\n/);

  // 구분자 자동 감지
  detectedDelimiter = null; // 리셋
  const delimiter = detectDelimiter(cleaned);

  // 8행(데이터 직전)을 우선 스캔하고, 못 찾은 헤더만 상위 행에서 보충
  const headerMapping = new Map<string, number>();
  const allHeaders: string[] = [];
  // 1단계: 8행 (index 7) 우선 스캔
  if (lines.length > 7) {
    const cols = parseCSVLine(lines[7], delimiter);
    cols.forEach((col, idx) => {
      const trimmed = col.trim();
      if (trimmed && HEADER_MAP[trimmed] && !headerMapping.has(trimmed)) {
        headerMapping.set(trimmed, idx);
      }
    });
  }
  // 2단계: 1~7행에서 아직 매핑 안 된 헤더만 보충 (역순 — 데이터 행에 가까울수록 우선)
  for (let row = Math.min(6, lines.length - 1); row >= 0; row--) {
    const cols = parseCSVLine(lines[row], delimiter);
    cols.forEach((col, idx) => {
      const trimmed = col.trim();
      if (trimmed && HEADER_MAP[trimmed] && !headerMapping.has(trimmed)) {
        headerMapping.set(trimmed, idx);
      }
    });
  }
  // 8행 기준으로 전체 헤더 목록 구성 (표시용)
  const headers = parseCSVLine(lines[7] || '', delimiter);
  // 1~8행에서 찾은 모든 매핑된 헤더
  const mappedHeaders = Array.from(headerMapping.keys());
  // 8행에서 매핑 안 된 컬럼
  const unmappedHeaders = headers.filter(h => h.trim() && !HEADER_MAP[h.trim()] && !mappedHeaders.includes(h.trim()));

  // 고객약호 컬럼 인덱스 찾기 (빈 행 필터용)
  const customerCodeIdx = headerMapping.get('고객약호');

  const dataLines = lines.slice(8).filter(line => {
    const cols = parseCSVLine(line, delimiter);
    if (customerCodeIdx !== undefined) {
      return cols[customerCodeIdx] && cols[customerCodeIdx].trim() !== '';
    }
    return cols.some(c => c.trim() !== '');
  });

  const rows = dataLines.map((line, index) => {
    const cols = parseCSVLine(line, delimiter);

    const status = getVal(cols, headerMapping, '매출 가능여부', '매출가능여부');
    const validStatuses = ['가능', '불가능', '확인중'];
    const parsedStatus = validStatuses.includes(status) ? status : '확인중';

    const mgmtType = getVal(cols, headerMapping, '관리구분', '내용');
    const parsedMgmt = mgmtType === '자재조정필요' ? '자재조정필요' : '중점관리품목';

    const materialCode = getVal(cols, headerMapping, '자재');
    const orderQty = getNumVal(cols, headerMapping, '총오더수량');
    const importance = getVal(cols, headerMapping, '중요도');
    const validImportance = ['상', '중', '하'];
    const parsedImportance = validImportance.includes(importance) ? importance : '';

    return {
      id: `item-${index}`,
      cis_manager: getVal(cols, headerMapping, 'CIS담당'),
      category: getVal(cols, headerMapping, '중분류명'),
      customer_code: getVal(cols, headerMapping, '고객약호'),
      customer_name: getVal(cols, headerMapping, '판매처이름'),
      team_name: getVal(cols, headerMapping, '영업팀명'),
      sales_manager: getVal(cols, headerMapping, '영업담당자명'),
      created_date: getVal(cols, headerMapping, '생성일'),
      original_due_date: getVal(cols, headerMapping, '원납기일'),
      order_lead_time: getNumVal(cols, headerMapping, '발주리드타임'),
      changed_due_date: getVal(cols, headerMapping, '변경납기', '변경납기일'),
      due_month: parseInt(getVal(cols, headerMapping, '변경납기월')) || 3,
      material_code: materialCode,
      item_name: getVal(cols, headerMapping, '내역'),
      total_quantity: getNumVal(cols, headerMapping, '총본품수량', '환산수량'),
      order_quantity: orderQty,
      delivered_quantity: getNumVal(cols, headerMapping, '납품수량'),
      remaining_quantity: getNumVal(cols, headerMapping, '미납잔량'),
      material_source: getVal(cols, headerMapping, '부자재 자급/사급', '자급사급'),
      production_request_date: getVal(cols, headerMapping, '생산완료 요청일', '생산완료요청일'),
      material_status: getVal(cols, headerMapping, '자재 1차', '자재1차'),
      week1: getVal(cols, headerMapping, '1주차'),
      week2: getVal(cols, headerMapping, '2주차'),
      week3: getVal(cols, headerMapping, '3주차'),
      delay_days: getNumVal(cols, headerMapping, '부자재 지연일수', '부자재지연일수'),
      mfg1: getVal(cols, headerMapping, '제조 1차', '제조1차', '기존제조', '기존 제조', '현재제조'),
      mfg_final: getVal(cols, headerMapping, '제조 최종', '제조최종'),
      pkg1: getVal(cols, headerMapping, '충포장 1차', '충포장1차'),
      pkg_final: getVal(cols, headerMapping, '충포장 최종', '충포장최종'),
      production_site: getVal(cols, headerMapping, '생산처'),
      lead_time: getVal(cols, headerMapping, '생산리드타임'),
      status: parsedStatus,
      progress_rate: getVal(cols, headerMapping, '진도율'),
      delay_reason: getVal(cols, headerMapping, '지연사유'),
      management_type: parsedMgmt,
      management_note: getVal(cols, headerMapping, '중점관리사항'),
      unit_price: getNumVal(cols, headerMapping, '단가'),
      sales_document: materialCode,
      original_order_quantity: orderQty,
      _importance: parsedImportance,
      _purchase_manager: getVal(cols, headerMapping, '구매담당'),
      _material_setting_date: getVal(cols, headerMapping, '부자재'),
      _manufacturing_date: getVal(cols, headerMapping, '제조'),
      _packaging_date: getVal(cols, headerMapping, '충포장'),
      _revenue_possible: getVal(cols, headerMapping, '매출'),
      _note: getVal(cols, headerMapping, '비고'),
      _partial: getVal(cols, headerMapping, '파셜여부'),
    };
  });

  // 디버깅: 매핑된 헤더 → 컬럼 인덱스 + 8행 전체 헤더
  const debugParts: string[] = [];
  headerMapping.forEach((idx, name) => {
    debugParts.push(`${name}→[${idx}]`);
  });
  const row8Parts: string[] = [];
  headers.forEach((h, i) => {
    const trimmed = h.trim();
    if (trimmed) row8Parts.push(`[${i}]=${trimmed}`);
  });
  const headerDebug = `구분자: ${delimiter === '\t' ? 'TAB' : 'COMMA'} | 8행 총 ${headers.length}개 컬럼\n매핑: ${debugParts.join(', ')}\n8행: ${row8Parts.join(' | ')}`;

  return { rows, unmappedHeaders, mappedHeaders, headerDebug };
}

interface AdminDataUploadProps {
  selectedMonth?: string;
  onMonthUploaded?: (month: string) => void;
}

export function AdminDataUpload({ selectedMonth, onMonthUploaded }: AdminDataUploadProps) {
  const [uploadMonth, setUploadMonth] = useState(selectedMonth || new Date().toISOString().slice(0, 7));
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [unmapped, setUnmapped] = useState<string[]>([]);
  const [mapped, setMapped] = useState<string[]>([]);
  const [debug, setDebug] = useState('');
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setResult(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const { rows, unmappedHeaders, mappedHeaders, headerDebug } = parseCSVToRows(text);
      setParsedRows(rows);
      setUnmapped(unmappedHeaders);
      setMapped(mappedHeaders);
      setDebug(headerDebug);
    };
    reader.readAsText(f, 'UTF-8');
  };

  const handleUpload = async () => {
    if (parsedRows.length === 0) return;
    setUploading(true);
    setResult(null);

    // ID에 월 prefix 추가 (월간 충돌 방지)
    const monthPrefix = uploadMonth !== '2026-03' ? `${uploadMonth}-` : '';
    const rowsWithMonth = parsedRows.map((row, idx) => ({
      ...row,
      id: `${monthPrefix}item-${idx}`,
    }));

    try {
      // 1단계: 해당 월의 기존 데이터 수 확인
      const { count: oldCount } = await supabase
        .from('dashboard_items')
        .select('*', { count: 'exact', head: true });

      // 2단계: 새 데이터 upsert (month 제외 — PostgREST 캐시 이슈 우회, DEFAULT 사용)
      for (let i = 0; i < rowsWithMonth.length; i += 100) {
        const batch = rowsWithMonth.slice(i, i + 100).map((row) => {
          const clean: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(row)) {
            if (!k.startsWith('_')) clean[k] = v;
          }
          return clean;
        });
        const { error } = await supabase.from('dashboard_items').upsert(batch);
        if (error) throw new Error(`dashboard_items 업로드 실패 (행 ${i}): ${error.message}`);
      }

      // 3단계: 초과 old 행 일괄 무효화
      if (oldCount && oldCount > rowsWithMonth.length) {
        const excessIds = Array.from(
          { length: oldCount - rowsWithMonth.length },
          (_, i) => `${monthPrefix}item-${rowsWithMonth.length + i}`
        );
        for (let i = 0; i < excessIds.length; i += 100) {
          const batch = excessIds.slice(i, i + 100);
          await supabase
            .from('dashboard_items')
            .update({ customer_code: '', item_name: '[삭제됨]' })
            .in('id', batch);
        }
      }

      // edit_data: CSV 값으로 초기화
      const editRows = rowsWithMonth.map(row => ({
        item_id: row.id,
        production_complete_date: (row.production_request_date as string) || '',
        material_setting_date: (row._material_setting_date as string) || '',
        manufacturing_date: (row._manufacturing_date as string) || '',
        packaging_date: (row._packaging_date as string) || '',
        revenue_possible: (row._revenue_possible as string) || '확인중',
        revenue_possible_quantity: row.remaining_quantity as number,
        delay_reason: '',
        importance: (row._importance as string) || '',
        purchase_manager: (row._purchase_manager as string) || '',
        note: (row._note as string) || '',
      }));

      for (let i = 0; i < editRows.length; i += 100) {
        const batch = editRows.slice(i, i + 100);
        const { error } = await supabase.from('edit_data').upsert(batch);
        if (error) throw new Error(`edit_data 업로드 실패 (행 ${i}): ${error.message}`);
      }

      onMonthUploaded?.(uploadMonth);
      setResult({ success: true, message: `${parseInt(uploadMonth.split('-')[1])}월 데이터 ${rowsWithMonth.length}건 업로드 완료. 2초 후 새로고침합니다...` });
      setTimeout(() => window.location.reload(), 2000);
    } catch (err: any) {
      setResult({ success: false, message: err.message });
    } finally {
      setUploading(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setParsedRows([]);
    setUnmapped([]);
    setMapped([]);
    setDebug('');
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-900">데이터 업로드</h2>
          <p className="text-sm text-slate-400 mt-1">CSV 파일을 업로드하여 대시보드 데이터를 갱신합니다. 해당 월의 기존 데이터는 교체됩니다.</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-sm font-bold text-slate-500">업로드 월:</label>
          <input
            type="month"
            value={uploadMonth}
            onChange={(e) => setUploadMonth(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
          />
        </div>
      </div>

      {/* Upload Area */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
        <div
          className={cn(
            "border-2 border-dashed rounded-2xl p-12 text-center transition-all cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/30",
            file ? "border-emerald-300 bg-emerald-50/30" : "border-slate-200"
          )}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            className="hidden"
          />
          {file ? (
            <div className="flex flex-col items-center gap-3">
              <FileSpreadsheet className="w-12 h-12 text-emerald-500" />
              <div>
                <p className="text-lg font-bold text-slate-900">{file.name}</p>
                <p className="text-sm text-slate-400">{(file.size / 1024).toFixed(1)} KB · {parsedRows.length}건 파싱 완료</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <Upload className="w-12 h-12 text-slate-300" />
              <div>
                <p className="text-lg font-bold text-slate-500">CSV 파일을 선택하세요</p>
                <p className="text-sm text-slate-400">클릭하여 파일을 선택하거나 여기에 드래그하세요</p>
              </div>
            </div>
          )}
        </div>

        {/* Header Mapping Info */}
        {parsedRows.length > 0 && (
          <div className="mt-6 space-y-3">
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
              <p className="text-xs font-bold text-emerald-700 mb-1">매핑 완료 ({mapped.length}개 컬럼)</p>
              <p className="text-xs text-emerald-600">{mapped.join(', ')}</p>
            </div>
            {unmapped.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                <p className="text-xs font-bold text-amber-700 mb-1">매핑 안 됨 ({unmapped.length}개 컬럼) — 무시됩니다</p>
                <p className="text-xs text-amber-600">{unmapped.join(', ')}</p>
              </div>
            )}
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
              <p className="text-xs font-bold text-slate-500 mb-1">8행 헤더 (인덱스:이름)</p>
              <p className="text-xs text-slate-400 break-all">{debug}</p>
            </div>
          </div>
        )}

        {/* Preview */}
        {parsedRows.length > 0 && (
          <div className="mt-6 border border-slate-100 rounded-xl overflow-hidden">
            <div className="bg-slate-50 px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
              미리보기 (상위 5건)
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left px-4 py-2 text-xs text-slate-400">ID</th>
                    <th className="text-left px-4 py-2 text-xs text-slate-400">고객약호</th>
                    <th className="text-left px-4 py-2 text-xs text-slate-400">자재</th>
                    <th className="text-left px-4 py-2 text-xs text-slate-400">내역</th>
                    <th className="text-right px-4 py-2 text-xs text-slate-400">미납잔량</th>
                    <th className="text-center px-4 py-2 text-xs text-slate-400">상태</th>
                    <th className="text-center px-4 py-2 text-xs text-slate-400">관리구분</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedRows.slice(0, 5).map(row => (
                    <tr key={row.id} className="border-b border-slate-50">
                      <td className="px-4 py-2 text-slate-500">{row.id}</td>
                      <td className="px-4 py-2 font-medium">{row.customer_code as string}</td>
                      <td className="px-4 py-2 text-slate-600">{row.material_code as string}</td>
                      <td className="px-4 py-2 text-slate-600 max-w-[200px] truncate">{row.item_name as string}</td>
                      <td className="px-4 py-2 text-right">{(row.remaining_quantity as number).toLocaleString()}</td>
                      <td className="px-4 py-2 text-center">{row.status as string}</td>
                      <td className="px-4 py-2 text-center">{row.management_type as string}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Actions */}
        {parsedRows.length > 0 && (
          <div className="mt-6 flex items-center gap-4">
            <button
              onClick={handleUpload}
              disabled={uploading}
              className={cn(
                "flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all",
                uploading
                  ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                  : "bg-slate-900 text-white hover:bg-emerald-600 shadow-lg shadow-slate-200"
              )}
            >
              <Upload className={cn("w-4 h-4", uploading && "animate-spin")} />
              {uploading ? '업로드 중...' : `${parsedRows.length}건 업로드`}
            </button>
            <button
              onClick={handleReset}
              className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-100 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              초기화
            </button>
          </div>
        )}

        {/* Result */}
        {result && (
          <div className={cn(
            "mt-6 flex items-center gap-3 px-5 py-4 rounded-xl border",
            result.success
              ? "bg-emerald-50 border-emerald-200 text-emerald-700"
              : "bg-red-50 border-red-200 text-red-700"
          )}>
            {result.success ? <CheckCircle className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
            <span className="text-sm font-bold">{result.message}</span>
          </div>
        )}
      </div>

      {/* Warning */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
        <div className="text-sm text-amber-700">
          <p className="font-bold mb-1">주의사항</p>
          <ul className="list-disc list-inside space-y-1 text-amber-600">
            <li>업로드 시 기존 데이터와 편집 내용이 모두 초기화됩니다.</li>
            <li>CSV 파일의 8행이 컬럼 헤더, 9행부터 데이터여야 합니다. 컬럼 순서는 자유입니다.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
