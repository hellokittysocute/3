import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface DrilldownModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
}

export const DrilldownModal: React.FC<DrilldownModalProps> = ({ isOpen, onClose, title, children }) => {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = 'hidden';
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKey);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-5"
      style={{ background: 'rgba(0,0,0,0.3)' }}
    >
      <div
        className="bg-white w-full sm:w-auto sm:min-w-[560px] sm:max-w-[800px] rounded-t-2xl sm:rounded-2xl max-h-[85vh] sm:max-h-[600px] flex flex-col"
        style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            {title}
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 ml-2"
            style={{ border: 'none', cursor: 'pointer' }}
          >
            <X size={14} color="#64748b" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto overflow-x-auto p-4 sm:p-5 flex-1">
          {children}
        </div>
      </div>
    </div>
  );
};
