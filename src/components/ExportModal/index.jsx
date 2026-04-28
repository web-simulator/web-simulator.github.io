import React, { useState } from 'react';
import Modal from '../Modal';
import { useTranslation } from 'react-i18next';

const ExportModal = ({ isOpen, onClose, onExportPng, onExportData, dataType = 'CSV' }) => {
    const { t } = useTranslation();
    const [selectedFormat, setSelectedFormat] = useState('data');

    const handleExport = () => {
        if (selectedFormat === 'png') {
            onExportPng();
        } else {
            onExportData();
        }
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} maxWidth="max-w-2xl">
            <div className="flex-shrink-0 px-6 py-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center w-12 h-12 rounded-full bg-emerald-100 text-emerald-600">
                        <i className="bi bi-download text-2xl"></i>
                    </div>
                    <div>
                        <h2 className="text-xl font-semibold text-slate-800">
                            {t('export_modal.title')}
                        </h2>
                        <p className="text-sm text-slate-500 mt-1">
                            {t('export_modal.subtitle')}
                        </p>
                    </div>
                </div>
                <button 
                    onClick={onClose}
                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-colors"
                >
                    <i className="bi bi-x-lg text-lg"></i>
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                    <label className={`relative flex flex-col p-5 border-2 rounded-xl cursor-pointer transition-colors group ${selectedFormat === 'png' ? 'border-emerald-500 bg-emerald-50/30' : 'border-slate-100 hover:border-emerald-200'}`}>
                        <input 
                            type="radio" 
                            name="format" 
                            value="png" 
                            checked={selectedFormat === 'png'} 
                            onChange={() => setSelectedFormat('png')}
                            className="sr-only" 
                        />

                        <div className={`absolute top-4 right-4 transition-all ${selectedFormat === 'png' ? 'opacity-100 scale-100 text-emerald-600' : 'opacity-0 scale-50 text-slate-300'}`}>
                            <i className="bi bi-check-circle-fill text-xl"></i>
                        </div>

                        <div className="relative z-10 flex flex-col gap-3">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${selectedFormat === 'png' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                                <i className="bi bi-image text-xl"></i>
                            </div>
                            <div>
                                <span className="block text-sm font-semibold text-slate-800 mb-1">
                                    {t('export_modal.png_title')}
                                </span>
                                <span className="block text-xs text-slate-500 leading-relaxed">
                                    {t('export_modal.png_desc')}
                                </span>
                            </div>
                        </div>
                    </label>

                    <label className={`relative flex flex-col p-5 border-2 rounded-xl cursor-pointer transition-colors group ${selectedFormat === 'data' ? 'border-emerald-500 bg-emerald-50/30' : 'border-slate-100 hover:border-emerald-200'}`}>
                        <input 
                            type="radio" 
                            name="format" 
                            value="data" 
                            checked={selectedFormat === 'data'} 
                            onChange={() => setSelectedFormat('data')}
                            className="sr-only" 
                        />

                        <div className={`absolute top-4 right-4 transition-all ${selectedFormat === 'data' ? 'opacity-100 scale-100 text-emerald-600' : 'opacity-0 scale-50 text-slate-300'}`}>
                            <i className="bi bi-check-circle-fill text-xl"></i>
                        </div>

                        <div className="relative z-10 flex flex-col gap-3">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${selectedFormat === 'data' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                                <i className="bi bi-file-earmark-bar-graph text-xl"></i>
                            </div>
                            <div>
                                <span className="block text-sm font-semibold text-slate-800 mb-1">
                                    {t('export_modal.data_title', { dataType })}
                                </span>
                                <span className="block text-xs text-slate-500 leading-relaxed">
                                    {t('export_modal.data_desc')}
                                </span>
                            </div>
                        </div>
                    </label>

                </div>
            </div>

            <div className="flex-shrink-0 px-6 py-4 border-t border-slate-100 bg-slate-50 flex flex-col-reverse sm:flex-row justify-end gap-3 rounded-b-2xl">
                <button 
                    onClick={onClose}
                    className="inline-flex justify-center items-center px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-200 transition-all"
                >
                    {t('export_modal.cancel')}
                </button>
                <button 
                    onClick={handleExport}
                    className="inline-flex justify-center items-center px-6 py-2.5 text-sm font-medium text-white bg-emerald-600 border border-transparent rounded-lg shadow-sm hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 transition-all"
                >
                    <i className="bi bi-download mr-2 font-bold"></i>
                    {t('export_modal.download')}
                </button>
            </div>
        </Modal>
    );
};

export default ExportModal;