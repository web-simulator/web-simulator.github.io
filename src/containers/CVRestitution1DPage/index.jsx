import { useState, useEffect, useCallback, useRef } from 'react';
import RestitutionChart from '../../components/RestitutionChart';
import Input from '../../components/Input';
import Button from '../../components/Button';
import ExportButton from '../../components/ExportButton';
import ExportModal from '../../components/ExportModal';
import Modal from '../../components/Modal';
import CVWorker from '../../simulation_cv_restitution_ms_1d.worker.js?worker';
import { useTranslation } from 'react-i18next';
import { export0DToCSV, exportToPng } from '../../utils/export';

const SettingsSection = ({ title, children, defaultOpen = false }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <details open={isOpen} onToggle={(e) => setIsOpen(e.target.open)} className="group mb-4 bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
      <summary className="flex items-center justify-between p-4 cursor-pointer bg-slate-50 hover:bg-slate-100 transition-colors select-none list-none">
        <h3 className="font-semibold text-slate-700">{title}</h3>
        <span className={`text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>
          <i className="bi bi-chevron-down"></i>
        </span>
      </summary>
      <div className="p-4 border-t border-slate-100 space-y-3">{children}</div>
    </details>
  );
};

const DEFAULT_EDITABLE_PARAMS = {
  k: 2.0, Tau_in: 0.3, Tau_out: 6.0, Tau_open: 120.0, Tau_close: 80.0, gate: 0.13,
  L: 100, dx: 1, dt: 0.05, inicio: 5.0, duracao: 1.0, amplitude: 1.0,
  posição_do_estímulo: 10, tamanho_do_estímulo: 5, num_estimulos: 8,
  BCL_S1: 250, BCL_S2_inicial: 350, BCL_S2_final: 100, delta_CL: 10
};

const CVRestitution1DPage = ({ onBack, isEmbedded }) => {
  const { t } = useTranslation();
  
  const [restitutionData, setRestitutionData] = useState([]);
  const [worker, setWorker] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [xAxisMetric, setXAxisMetric] = useState('ci');
  
  // Modais
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('basic');
  const chartRef = useRef(null);

  const [editableParams, setEditableParams] = useState(DEFAULT_EDITABLE_PARAMS);

  useEffect(() => {
    const restWorker = new CVWorker();
    setWorker(restWorker);
    restWorker.onmessage = (e) => {
      setRestitutionData(e.data);
      setLoading(false);
    };
    return () => restWorker.terminate();
  }, []);

  const handleChange = useCallback((e, name) => {
    const value = parseFloat(e.target.value);
    setEditableParams((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleSimularClick = useCallback(() => {
    if (worker) {
      setLoading(true);
      setRestitutionData([]);
      worker.postMessage(editableParams);
    }
  }, [worker, editableParams]);

  const handleReset = useCallback(() => {
    setEditableParams(DEFAULT_EDITABLE_PARAMS);
    setRestitutionData([]);
  }, []);

  const renderInfoModalContent = () => {
    return (
      <div className="flex flex-col h-full max-h-[80vh]">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-emerald-800">{t('modals.cv1d.title', 'Curva de Restituição 1D')}</h2>
        </div>

        <div className="flex border-b border-slate-200 mb-6 overflow-x-auto custom-scrollbar">
            {['basic', 'advanced', 'math'].map((tab) => (
                <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-6 py-2 font-medium text-sm transition-colors relative whitespace-nowrap ${
                    activeTab === tab ? 'text-emerald-600' : 'text-slate-500 hover:text-emerald-500'
                }`}
                >
                {t(`modals.cv1d.tabs.${tab}`)}
                {activeTab === tab && (
                    <div className="absolute bottom-0 left-0 w-full h-0.5 bg-emerald-500 animate-slideInRight" />
                )}
                </button>
            ))}
        </div>

        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
          {activeTab === 'basic' && (
            <div className="space-y-4 animate-fadeIn">
              <h3 className="text-xl font-bold text-slate-700">{t('modals.cv1d.basic.title', 'O que é a Curva de Restituição?')}</h3>
              <p className="text-slate-600 leading-relaxed text-justify mb-4">
                {t('modals.cv1d.basic.desc', 'A Curva de Restituição (Velocidade de Condução) mostra como a velocidade de propagação do potencial de ação se adapta em resposta a diferentes frequências cardíacas.')}
              </p>
              <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-4 mt-4">
                 <h4 className="font-semibold text-emerald-800 mb-2">
                    <i className="bi bi-activity mr-2"></i>
                    {t('modals.cv1d.basic.goal', 'Objetivo Prático')}
                 </h4>
                 <p className="text-sm text-emerald-700 leading-relaxed text-justify">
                    {t('modals.cv1d.basic.goal_desc', 'Avaliar a estabilidade elétrica do tecido ao simular o protocolo S1-S2, permitindo identificar condições que levam a arritmias.')}
                 </p>
              </div>
            </div>
          )}

          {activeTab === 'advanced' && (
            <div className="space-y-6 animate-fadeIn">
              <h3 className="text-xl font-bold text-slate-700">{t('modals.cv1d.advanced.title', 'Protocolo S1-S2 em 1D')}</h3>
              <p className="text-slate-600 leading-relaxed text-justify">
                {t('modals.cv1d.advanced.desc', 'O protocolo aplica um trem de estímulos (S1) com um comprimento de ciclo básico (BCL) constante para atingir o estado estacionário, seguido por um estímulo prematuro (S2).')}
              </p>
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mt-4">
                 <h4 className="font-semibold text-slate-700 mb-2">{t('modals.cv1d.advanced.visualizations', 'Métricas do Eixo X')}</h4>
                 <p className="text-sm text-slate-600 text-justify">
                   {t('modals.cv1d.advanced.visualizations_desc', 'Você pode plotar a Velocidade de Condução (CV) em função do Intervalo de Acoplamento (CI) ou do Intervalo Diastólico (DI). O DI reflete mais diretamente o tempo de recuperação dos canais iônicos.')}
                 </p>
              </div>
            </div>
          )}

          {activeTab === 'math' && (
            <div className="space-y-4 animate-fadeIn">
              <h3 className="text-xl font-bold text-slate-700">{t('modals.cv1d.math.title', 'Cálculo da Velocidade (CV)')}</h3>
              <p className="text-slate-600 text-sm mb-4">
                {t('modals.cv1d.math.desc', 'A Velocidade de Condução é calculada dividindo a distância física pela diferença de tempo de ativação entre dois pontos do cabo.')}
              </p>
              <div className="bg-slate-50 border border-slate-200 border-l-4 border-l-emerald-500 text-slate-700 p-4 rounded-r-lg font-mono text-sm space-y-2 overflow-x-auto custom-scrollbar mb-2">
                 <p>CV = Δx / Δt</p>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-auto lg:overflow-hidden">
      {!isEmbedded && (
        <header className="bg-white border-b border-slate-200 h-16 flex-none flex items-center justify-between px-6 shadow-sm z-20">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="p-2 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-full transition-colors">
              <i className="bi bi-arrow-left text-xl"></i>
            </button>
            <h1 className="text-xl font-bold text-slate-800">{t('home.models.cv_1d.title', 'Curva de Restituição 1D')}</h1>
          </div>
        </header>
      )}

      <div className="flex-1 flex flex-col lg:flex-row lg:overflow-hidden">
        <aside className="w-full lg:w-96 bg-white border-r border-slate-200 lg:overflow-y-auto custom-scrollbar flex-none shadow-xl z-10">
          <div className="p-6 pb-6">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">{t('common.configuration')}</p>

            <SettingsSection title={t('common.view_options', 'Visualização')} defaultOpen={true}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700">{t('common.x_axis_metric', 'Métrica do Eixo X')}</span>
                <select 
                  value={xAxisMetric} 
                  onChange={(e) => setXAxisMetric(e.target.value)}
                  className="px-2 py-1 bg-white border border-slate-300 rounded-lg text-sm text-slate-700 focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                >
                  <option value="ci">{t('common.coupling_interval', 'Intervalo de Acoplamento (CI)')}</option>
                  <option value="di">{t('common.diastolic_interval', 'Intervalo Diastólico (DI)')}</option>
                </select>
              </div>
            </SettingsSection>

            <SettingsSection title={t('common.simulation_params')} defaultOpen={true}>
              <div className="grid grid-cols-2 gap-3">
                {Object.keys(editableParams).map((key) => (
                  <Input key={key} label={t(`params.${key}`) || key} value={editableParams[key]} onChange={(e) => handleChange(e, key)} type="number" className="mb-0" />
                ))}
              </div>
            </SettingsSection>
          </div>
        </aside>

        <main className="flex-1 bg-slate-100 relative flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 flex flex-col items-center">
            <div ref={chartRef} className="w-full max-w-5xl bg-white rounded-lg shadow-sm border border-slate-200 p-4 mb-4 min-h-[400px] flex flex-col justify-center">
              {restitutionData.length > 0 ? (
                <>
                  <h3 className="text-lg font-bold text-slate-700 mb-4 pl-2 border-l-4 border-emerald-500">
                    {t('chart.conduction_velocity', 'Velocidade de Condução')}
                  </h3>
                  <RestitutionChart 
                    data={restitutionData} analyticalData={[]} xDataKey={xAxisMetric} yDataKey="cv"
                    xLabel={xAxisMetric === 'ci' ? 'Coupling Interval (CI)' : 'Diastolic Interval (DI)'}
                    yLabel="CV" xUnit="ms" yUnit="cm/ms" lineName={t('chart.conduction_velocity', 'Velocidade de Condução')}
                  />
                </>
              ) : (
                <div className="h-full w-full flex flex-col items-center justify-center text-slate-400 py-20">
                  <i className="bi bi-graph-up text-6xl mb-4 opacity-50"></i>
                  <p>{t('common.ready')}</p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white border-t border-slate-200 p-4 shadow-lg z-20">
            <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  onClick={handleSimularClick} disabled={loading || exporting}
                  className={`rounded-full px-6 py-2 font-bold text-white shadow-md transition-transform active:scale-95 flex items-center gap-2 ${loading ? 'bg-slate-400 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700'}`}
                >
                  {loading ? <span className="animate-spin"><i className="bi bi-arrow-repeat"></i></span> : <i className="bi bi-play-fill text-xl"></i>}
                  {loading ? t('common.simulating') : t('common.simulate')}
                </button>

                <button
                  onClick={handleReset}
                  className="rounded-full px-6 py-2 font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors shadow-sm flex items-center gap-2"
                  title={t('common.reset')}
                >
                  <i className="bi bi-arrow-counterclockwise text-lg"></i> <span className="hidden sm:inline">{t('common.reset')}</span>
                </button>

                {restitutionData.length > 0 && (
                  <>
                    <ExportButton onClick={() => setIsExportModalOpen(true)} disabled={exporting} />
                    <ExportModal 
                      mode="0d" 
                      isOpen={isExportModalOpen} onClose={() => setIsExportModalOpen(false)}
                      onExportPng={() => exportToPng(chartRef, 'ms_1d_cv_restitution')}
                      onExportData={() => export0DToCSV(restitutionData, 'ms_1d_cv_restitution')}
                    />
                  </>
                )}
              </div>
              
              <div className="ml-auto flex-shrink-0">
                <Button onClick={() => setIsInfoModalOpen(true)} className="bg-slate-100 text-slate-600 hover:bg-slate-200 p-2 rounded-lg" title={t('common.more_info')}>
                  <i className="bi bi-info-circle text-lg"></i> <span className="md:hidden ml-2">{t('common.more_info')}</span>
                </Button>
              </div>
            </div>
          </div>
        </main>
      </div>

      <Modal isOpen={isInfoModalOpen} onClose={() => setIsInfoModalOpen(false)}>
        {renderInfoModalContent()}
      </Modal>
    </div>
  );
};

export default CVRestitution1DPage;