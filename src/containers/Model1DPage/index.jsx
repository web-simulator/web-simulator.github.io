import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import MitchellSchaeffer1DPage from '../MitchellSchaeffer1DPage';
import BistablePage from '../BistablePage';
import FitzHughNagumoPage from '../FitzHughNagumoPage';

import TenTusscher1DPage from '../TenTusscher1DPage';

const Model1DPage = ({ onBack }) => {
  const { t } = useTranslation();
  const [selectedModel, setSelectedModel] = useState('ms_1d');

  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-auto lg:overflow-hidden">
      {/* Cabeçalho */}
      <header className="bg-white border-b border-slate-200 h-16 flex-none flex items-center justify-between px-6 shadow-sm z-20 sticky top-0 lg:relative">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-full transition-colors">
            <i className="bi bi-arrow-left text-xl"></i>
          </button>
          <h1 className="text-xl font-bold text-slate-800 hidden sm:block">
            {t('home.models.model_1d.title', 'Modelos de Cabo 1D')}
          </h1>
        </div>
        
        {/* Seletor de Modelos */}
        <div className="flex items-center gap-2">
          <label htmlFor="model-select" className="text-sm font-medium text-slate-700 hidden md:block">
            {t('common.select_model', 'Modelo:')}
          </label>
          <select 
            id="model-select"
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="px-3 py-1.5 bg-slate-100 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 cursor-pointer"
          >
            <option value="ms_1d">{t('home.models.ms_1d.title', 'Mitchell-Schaeffer')}</option>
            <option value="fhn">{t('home.models.fhn.title', 'FitzHugh-Nagumo')}</option>
            <option value="bistable">{t('home.models.bistable.title', 'Bistable')}</option>
            <option value="tentusscher">{t('common.tentusscher_model', 'Ten Tusscher ')}</option>
          </select>
        </div>
      </header>

      {/* Renderização dos Modelos */}
      <div className="flex-1 flex flex-col min-h-0 relative">
        {selectedModel === 'ms_1d' && <MitchellSchaeffer1DPage isEmbedded={true} />}
        {selectedModel === 'fhn' && <FitzHughNagumoPage isEmbedded={true} />}
        {selectedModel === 'bistable' && <BistablePage isEmbedded={true} />}
        {selectedModel === 'tentusscher' && <TenTusscher1DPage isEmbedded={true} />}
      </div>
    </div>
  );
};

export default Model1DPage;