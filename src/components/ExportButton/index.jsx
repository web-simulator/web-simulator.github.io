import React from 'react';
// Componente de botão de exportação
const ExportButton = ({ onClick, label, disabled = false, className = '' }) => {
  return (
    <button 
        onClick={onClick}
        disabled={disabled}
        className={`w-full md:w-auto rounded-full px-6 py-2 font-medium text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 hover:text-emerald-600 shadow-sm transition-all active:scale-95 flex items-center justify-center gap-2 ${className} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
        <i className="bi bi-download"></i> {label}
    </button>
  );
};

export default ExportButton;