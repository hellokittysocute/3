import React, { useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Upload, FileSpreadsheet, CheckCircle, AlertTriangle, Trash2 } from 'lucide-react';
import { cn } from '../lib/utils';

interface ParsedRow {
  id: string;
  [key: string]: unknown;
}

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

function parseCSVToRows(csvText: string): ParsedRow[] {
  const cleaned = csvText.replace(/^\uFEFF/, '');
  const lines = cleaned.split(/\r?\n/);
  const dataLines = lines.slice(5).filter(line => {
    const cols = parseCSVLine(line);
    return cols[3] && cols[3].trim() !== '';
  });

  return dataLines.map((line, index) => {
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
}

export function AdminDataUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
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
      const rows = parseCSVToRows(text);
      setParsedRows(rows);
    };
    reader.readAsText(f, 'UTF-8');
  };

  const handleUpload = async () => {
    if (parsedRows.length === 0) return;
    setUploading(true);
    setResult(null);

    try {
      // 기존 데이터 삭제 (edit_data → dashboard_items 순서: FK 제약조건)
      const { error: delEditErr } = await supabase.from('edit_data').delete().gte('item_id', '');
      if (delEditErr) throw new Error(`edit_data 삭제 실패: ${delEditErr.message}`);

      const { error: delDashErr } = await supabase.from('dashboard_items').delete().gte('id', '');
      if (delDashErr) throw new Error(`dashboard_items 삭제 실패: ${delDashErr.message}`);

      // dashboard_items 업로드
      for (let i = 0; i < parsedRows.length; i += 100) {
        const batch = parsedRows.slice(i, i + 100);
        const { error } = await supabase.from('dashboard_items').upsert(batch);
        if (error) throw new Error(`dashboard_items 업로드 실패 (행 ${i}): ${error.message}`);
      }

      // edit_data 초기화
      const editRows = parsedRows.map(row => ({
        item_id: row.id,
        production_complete_date: '',
        material_setting_date: '',
        manufacturing_date: '',
        packaging_date: '',
        revenue_possible: '',
        revenue_possible_quantity: row.remaining_quantity as number,
        delay_reason: '',
      }));

      for (let i = 0; i < editRows.length; i += 100) {
        const batch = editRows.slice(i, i + 100);
        const { error } = await supabase.from('edit_data').upsert(batch);
        if (error) throw new Error(`edit_data 업로드 실패 (행 ${i}): ${error.message}`);
      }

      setResult({ success: true, message: `${parsedRows.length}건 업로드 완료` });
    } catch (err: any) {
      setResult({ success: false, message: err.message });
    } finally {
      setUploading(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setParsedRows([]);
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-black text-slate-900">데이터 업로드</h2>
        <p className="text-sm text-slate-400 mt-1">CSV 파일을 업로드하여 대시보드 데이터를 갱신합니다. 기존 데이터는 교체됩니다.</p>
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
            <li>CSV 파일은 기존 양식과 동일한 형식이어야 합니다 (상위 5행 헤더 포함).</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
