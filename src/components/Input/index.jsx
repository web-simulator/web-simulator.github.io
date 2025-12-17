import React from 'react';

const Input = ({ label, value, onChange, type = "text", step, min, max, disabled, className = "" }) => {
  return (
    <div className={`flex flex-col gap-1.5 mb-4 ${className}`}>
      {label && (
        <label className="text-sm font-medium text-slate-700 ml-1">
          {label}
        </label>
      )}
      <input
        type={type}
        value={value}
        onChange={onChange}
        step={step}
        min={min}
        max={max}
        disabled={disabled}
        className={`
          w-full px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-sm shadow-sm transition-all duration-200
          placeholder:text-slate-400
          focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20
          hover:border-slate-400
          disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed
        `}
      />
    </div>
  );
};

export default Input;