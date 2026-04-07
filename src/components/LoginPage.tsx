import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { LayoutDashboard } from 'lucide-react';

export function LoginPage() {
  const { signIn } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-200/60 p-10 text-center">
          {/* Logo */}
          <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center shadow-lg shadow-slate-200 mx-auto mb-6">
            <LayoutDashboard className="text-white w-8 h-8" />
          </div>

          <h1 className="text-2xl font-black tracking-tight text-slate-900 mb-2">
            MKT 중점관리 품목 대시보드
          </h1>
          <p className="text-sm text-slate-400 font-medium mb-8">
            서비스를 이용하려면 회사 계정으로 로그인하세요
          </p>

          {/* Microsoft Login Button */}
          <button
            onClick={signIn}
            className="w-full flex items-center justify-center gap-3 px-6 py-3.5 bg-white border-2 border-slate-200 rounded-2xl text-[15px] font-bold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all duration-200 shadow-sm hover:shadow-md"
          >
            <svg className="w-5 h-5" viewBox="0 0 23 23">
              <path fill="#f35325" d="M1 1h10v10H1z" />
              <path fill="#81bc06" d="M12 1h10v10H12z" />
              <path fill="#05a6f0" d="M1 12h10v10H1z" />
              <path fill="#ffba08" d="M12 12h10v10H12z" />
            </svg>
            Microsoft 계정으로 로그인
          </button>

          <p className="text-xs text-slate-400 mt-6">
            인가된 사용자만 서비스를 이용할 수 있습니다.
            <br />
            최초 로그인 후 관리자의 승인이 필요합니다.
          </p>
        </div>
      </div>
    </div>
  );
}
