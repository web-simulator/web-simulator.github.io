import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Chart from '../../components/Chart';
import Input from '../../components/Input';
import Button from '../../components/Button';
import RestitutionChart from '../../components/RestitutionChart';
import Modal from '../../components/Modal';
import ExportButton from '../../components/ExportButton';
import RestitutionWorker from '../../simulation_restitution.worker.js?worker';
import MMSWorker from '../../simulation_mms_restitution_alt.worker.js?worker';
import DynamicWorker from '../../simulation_dynamic_protocol1.worker.js?worker';
import MinimalWorker from '../../simulation_minimal_restitution.worker.js?worker';
import { useTranslation } from 'react-i18next';
import { exportToPng } from '../../utils/export';

/* Componente para seções expansíveis na sidebar */
const SettingsSection = ({ title, children, defaultOpen = false }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <details 
      open={isOpen} 
      onToggle={(e) => setIsOpen(e.target.open)}
      className="group mb-4 bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm"
    >
      <summary className="flex items-center justify-between p-4 cursor-pointer bg-slate-50 hover:bg-slate-100 transition-colors select-none list-none">
        <h3 className="font-semibold text-slate-700">{title}</h3>
        <span className={`text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>
          <i className="bi bi-chevron-down"></i>
        </span>
      </summary>
      <div className="p-4 border-t border-slate-100 space-y-3">
        {children}
      </div>
    </details>
  );
};

// Configuração das variáveis por modelo
const MODEL_VARIABLES = {
  s1s2: ['v', 'h'],
  mms: ['v', 'h'],
  dynamic: ['v', 'h'],
  minimal: ['v', 'gate_v', 'gate_w', 'gate_s']
};

const VARIABLE_LABELS = {
  v: 'Voltagem',
  h: 'Gate h',
  gate_v: 'Gate v',
  gate_w: 'Gate w',
  gate_s: 'Gate s'
};

const DEFAULT_MINIMAL_PARAMS = {
  endo: {
    u_o: 0.0, u_u: 1.56, theta_v: 0.3, theta_w: 0.13, theta_vminus: 0.2, theta_o: 0.006,
    tau_v1minus: 75.0, tau_v2minus: 10.0, tau_vplus: 1.4506,
    tau_w1minus: 6.0, tau_w2minus: 140.0, k_wminus: 200.0, u_wminus: 0.016, tau_wplus: 280.0,
    tau_fi: 0.15, tau_o1: 470.0, tau_o2: 6.0, tau_so1: 40.0, tau_so2: 1.2,
    k_so: 2.0, u_so: 0.65, tau_s1: 2.7342, tau_s2: 2.0, k_s: 2.0994, u_s: 0.9087, tau_si: 2.9013,
    tau_winf: 0.0273, w_infstar: 0.78
  },
  myo: {
    u_o: 0.0, u_u: 1.61, theta_v: 0.3, theta_w: 0.13, theta_vminus: 0.1, theta_o: 0.005,
    tau_v1minus: 80.0, tau_v2minus: 1.4506, tau_vplus: 1.4506,
    tau_w1minus: 70.0, tau_w2minus: 8.0, k_wminus: 200.0, u_wminus: 0.016, tau_wplus: 280.0,
    tau_fi: 0.117, tau_o1: 410.0, tau_o2: 7.0, tau_so1: 91.0, tau_so2: 0.8,
    k_so: 2.1, u_so: 0.6, tau_s1: 2.7342, tau_s2: 4.0, k_s: 2.0994, u_s: 0.9087, tau_si: 3.3849,
    tau_winf: 0.01, w_infstar: 0.5
  },
  epi: {
    u_o: 0.0, u_u: 1.55, theta_v: 0.3, theta_w: 0.13, theta_vminus: 0.006, theta_o: 0.006,
    tau_v1minus: 60.0, tau_v2minus: 1150.0, tau_vplus: 1.4506,
    tau_w1minus: 60.0, tau_w2minus: 15.0, k_wminus: 65.0, u_wminus: 0.03, tau_wplus: 200.0,
    tau_fi: 0.165, tau_o1: 400.0, tau_o2: 6.0, tau_so1: 30.0181, tau_so2: 0.9957,
    k_so: 2.0458, u_so: 0.65, tau_s1: 2.7342, tau_s2: 16.0, k_s: 2.0994, u_s: 0.9087, tau_si: 1.8875,
    tau_winf: 0.07, w_infstar: 0.94
  }
};

const RestitutionCurvePage = ({ onBack }) => {
  const { t } = useTranslation();
  const [data, setData] = useState([]);
  const [restitutionData, setRestitutionData] = useState([]);
  const [analyticalData, setAnalyticalData] = useState([]);
  const [worker, setWorker] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showTimeSeries, setShowTimeSeries] = useState(false);
  const [selectedModel, setSelectedModel] = useState('minimal');
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false); 
  const [minimalCustomParams, setMinimalCustomParams] = useState(DEFAULT_MINIMAL_PARAMS);
  const [visibleVars, setVisibleVars] = useState({ v: true, gate_v: true, gate_w: true, gate_s: true });
  const chartRef = useRef(null);

  // Parâmetros editáveis para cada modelo
  const [editableParams, setEditableParams] = useState({
    // Parâmetros para o modelo S1S2
    s1s2: {
      BCL_S1: 250, 
      BCL_S2_inicial: 200, 
      BCL_S2_final: 100, 
      delta_CL: 10, 
      tau_in: 0.3, 
      tau_out: 6.0, 
      tau_open: 120.0, 
      tau_close: 150.0, 
      v_gate: 0.13, 
      inicio: 5.0, 
      duracao: 1.0, 
      amplitude: 1.0, 
      dt: 0.1, 
      v_inicial: 0.0, 
      h_inicial: 1.0, 
      num_estimulos_s1: 8, 
      downsamplingFactor: 50, 
    },
    // Parâmetros para o modelo MMS
    mms: {
      BCL_S1: 1000,
      BCL_S2_inicial: 900,
      BCL_S2_final: 200,
      delta_CL: 20,
      tau_in: 0.3, 
      tau_out: 6.0, 
      tau_open: 120.0, 
      tau_close: 150.0, 
      v_gate: 0.13, 
      inicio: 5.0, 
      duracao: 1.0, 
      amplitude: 1.0, 
      dt: 0.1, 
      v_inicial: 0.0, 
      h_inicial: 1.0, 
      num_estimulos_s1: 8, 
      downsamplingFactor: 1000,
    },
    // Parâmetros para o modelo Dinâmico
    dynamic: {
      CI1: 500, 
      CI0: 250, 
      CIinc: 10, 
      nbeats: 5, 
      tau_in: 0.3,
      tau_out: 6.0, 
      tau_open: 120.0, 
      tau_close: 150.0, 
      v_gate: 0.13, 
      inicio: 5.0, 
      duracao: 1.0, 
      amplitude: 1.0, 
      dt: 0.1, 
      v_inicial: 0.0, 
      h_inicial: 1.0, 
      downsamplingFactor: 50,
    },
    // Parâmetros para o Minimal Model
    minimal: {
      cellType: 'epi',
      BCL_S1: 600,
      BCL_S2_inicial: 500,
      BCL_S2_final: 200,
      delta_CL: 10,
      inicio: 10.0,
      duracao: 1.0,
      amplitude: 1.0,
      dt: 0.1,
      num_estimulos_s1: 8,
      downsamplingFactor: 100
    }
  });

  // Função para calcular a curva analítica
  const calculateAnalyticalCurve = useCallback((simulatedData) => {
    if (!simulatedData || simulatedData.length === 0) {
      setAnalyticalData([]);
      return;
    }
    if (selectedModel === 'minimal') {
      setAnalyticalData([]);
      return;
    }
    let analyticalPoints = [];
    const currentParams = editableParams[selectedModel];
    const { tau_out, tau_in, tau_close, tau_open, v_gate } = currentParams;

    if (selectedModel === 'mms') {
      // Calculo analitico do modelo MMS
      const h_mms_min = Math.pow(1 + (tau_out / (4 * tau_in)) * Math.pow(1 - v_gate, 2), -1);
      analyticalPoints = simulatedData.map(point => {
        const di = point.bcl; 
        const analyticalApd = tau_close * Math.log((1 - (1 - h_mms_min) * Math.exp(-di / tau_open)) / h_mms_min);
        if (analyticalApd && analyticalApd > 0) return { bcl: di, apd: analyticalApd };
        return null;
      }).filter(Boolean); 
    } else if (selectedModel === 's1s2' || selectedModel === 'dynamic') {
      // Calculo analitico do modelo MS padrão
      const h_min = (4 * tau_in) / tau_out;
      analyticalPoints = simulatedData.map(point => {
        const di = point.bcl; 
        const numerator = 1 - (1 - h_min) * Math.exp(-di / tau_open);
        const analyticalApd = tau_close * Math.log(numerator / h_min);
        if (analyticalApd && analyticalApd > 0) return { bcl: di, apd: analyticalApd };
        return null;
      }).filter(Boolean); 
    }

    setAnalyticalData(analyticalPoints); 
  }, [editableParams, selectedModel]);

  useEffect(() => {
    let simulationWorker;
    if (selectedModel === 's1s2') simulationWorker = new RestitutionWorker(); 
    else if (selectedModel === 'mms') simulationWorker = new MMSWorker();
    else if (selectedModel === 'minimal') simulationWorker = new MinimalWorker();
    else simulationWorker = new DynamicWorker();

    // Resetar visibilidade ao trocar de modelo
    if (selectedModel === 'minimal') {
      setVisibleVars({ v: true, gate_v: true, gate_w: true, gate_s: true });
    } else {
      setVisibleVars({ v: true, h: true });
    }

    setWorker(simulationWorker);
    simulationWorker.onmessage = (e) => {
      const { timeSeriesData, restitutionData } = e.data;
      if (timeSeriesData) setData(timeSeriesData);
      setRestitutionData(restitutionData);
      calculateAnalyticalCurve(restitutionData); 
      setLoading(false);
    };
    return () => simulationWorker.terminate();
  }, [selectedModel, calculateAnalyticalCurve]); 

  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];
    const activeKeys = ['time', 'tempo', ...Object.keys(visibleVars).filter(k => visibleVars[k])];
    return data.map(point => {
      const newPoint = {};
      activeKeys.forEach(key => {
        if (point[key] !== undefined) newPoint[key] = point[key];
      });
      return newPoint;
    });
  }, [data, visibleVars]);

  const handleChange = useCallback((e, name) => {
    const value = name === 'cellType' ? e.target.value : parseFloat(e.target.value);
    setEditableParams((prev) => ({
      ...prev,
      [selectedModel]: {
        ...prev[selectedModel],
        [name]: value
      }
    }));
  }, [selectedModel]);

  // Função para lidar com mudanças nos parâmetros de celula
  const handleMinimalCustomChange = (param, value) => {
    const activeType = editableParams.minimal.cellType;
    setMinimalCustomParams(prev => ({
      ...prev,
      [activeType]: {
        ...prev[activeType],
        [param]: parseFloat(value)
      }
    }));
  };

  // Função para iniciar a simulação
  const handleSimularClick = useCallback(() => {
    if (worker) {
      setLoading(true);
      setData([]);
      setRestitutionData([]);
      setAnalyticalData([]);
      const payload = { ...editableParams[selectedModel] };
      if (selectedModel === 'minimal') payload.minimalCellParams = minimalCustomParams;
      worker.postMessage(payload);
    }
  }, [worker, editableParams, selectedModel, minimalCustomParams]);

  const toggleVariable = (variableKey) => {
    setVisibleVars(prev => ({
      ...prev,
      [variableKey]: !prev[variableKey]
    }));
  };

  const handleExport = useCallback(() => {
    exportToPng(chartRef, `restitution_${selectedModel}`);
  }, [selectedModel]);

  const renderInfoModalContent = () => {
    const modelKey = selectedModel;
    const steps = t(`modals.restitution.${modelKey}.steps`, { returnObjects: true });
    
    // Lista de parâmetros relevantes para exibir no modal
    const currentParamsList = Object.keys(editableParams[selectedModel]);

    return (
      <div className="info-modal-content text-slate-800 space-y-6 max-h-[80vh] overflow-y-auto pr-2 custom-scrollbar">
        <section>
          <h2 className="text-2xl font-bold text-emerald-800 mb-2">{t(`modals.restitution.${modelKey}.title`)}</h2>
          <h3 className="text-lg font-bold text-slate-700 border-b border-slate-200 pb-1 mb-3">{t('modals.restitution.what_is')}</h3>
          <p className="text-slate-600 leading-relaxed mb-4">{t('modals.restitution.what_is_desc')}</p>
          
          <h3 className="text-lg font-bold text-slate-700 border-b border-slate-200 pb-1 mb-3">{t('modals.restitution.measuring')}</h3>
          <ul className="list-disc ml-5 text-slate-600 mb-4">
            <li>{t('modals.restitution.apd_def')}</li>
            <li>{t('modals.restitution.di_def')}</li>
          </ul>
        </section>

        <section>
          <h3 className="text-lg font-bold text-slate-700 border-b border-slate-200 pb-1 mb-3">{t('modals.protocol')}</h3>
          <p className="text-slate-600 mb-2">{t(`modals.restitution.${modelKey}.desc`)}</p>
          <ol className="list-decimal ml-5 text-slate-600 space-y-1">
            {Array.isArray(steps) && steps.map((step, index) => <li key={index}>{step}</li>)}
          </ol>
        </section>

        <section>
          <h3 className="text-lg font-bold text-slate-700 border-b border-slate-200 pb-1 mb-3">{t('modals.math_model')}</h3>
          {selectedModel === 'minimal' ? (
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 font-mono text-sm space-y-2 mb-4">
              <p>{t('modals.restitution.minimal.eq_u')}</p>
              <p>{t('modals.restitution.minimal.eq_v')}</p>
              <p>{t('modals.restitution.minimal.eq_w')}</p>
              <p>{t('modals.restitution.minimal.eq_s')}</p>
              <div className="mt-4 pt-2 border-t border-slate-200">
                 <p className="font-sans font-bold text-slate-700 mb-1">{t('modals.restitution.minimal.vars')}</p>
                 <p className="font-sans text-slate-600">{t('modals.restitution.minimal.currents')}</p>
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 font-mono text-sm space-y-2">
              <p>{t(`modals.restitution.${modelKey}.eq_v`)}</p>
              <p>{t(`modals.restitution.${modelKey}.eq_h`)}</p>
            </div>
          )}
        </section>

        <section>
          <h3 className="text-lg font-bold text-slate-700 border-b border-slate-200 pb-1 mb-3">{t('modals.numerical_method')}</h3>
          <p className="text-slate-600 text-sm">{t(`modals.restitution.${modelKey}.method`)}</p>
        </section>

        <section>
          <h3 className="text-lg font-bold text-slate-700 border-b border-slate-200 pb-1 mb-3">{t('modals.param_meaning')}</h3>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-slate-600">
            {currentParamsList.map((param) => (
              <li key={param} className="flex gap-1">
                <strong className="font-bold text-slate-700">{t(`params.${param}`) || param}:</strong> {t(`params.${param}_desc`) || ''}
              </li>
            ))}
          </ul>
        </section>
      </div>
    );
  };
  
  // Parâmetros atuais baseados no modelo selecionado
  const currentParams = editableParams[selectedModel];
  const currentVariables = MODEL_VARIABLES[selectedModel];

  // Renderiza a página
  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-auto lg:overflow-hidden">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 h-16 flex-none flex items-center justify-between px-6 shadow-sm z-20 sticky top-0 lg:relative">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-full transition-colors">
            <i className="bi bi-arrow-left text-xl"></i>
          </button>
          <h1 className="text-xl font-bold text-slate-800 hidden sm:block">{t('home.models.restitution_curve.title')}</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-500 hidden sm:block">{t('common.select_model')}:</span>
          <select 
            value={selectedModel} 
            onChange={(e) => { 
                setSelectedModel(e.target.value); 
                setRestitutionData([]); 
                setData([]); 
                setAnalyticalData([]);
            }} 
            className="bg-slate-100 border-none text-sm font-medium text-slate-700 py-2 px-4 rounded-lg cursor-pointer focus:ring-2 focus:ring-emerald-500"
          >
            <option value="minimal">{t('modals.restitution.minimal.title')}</option>
            <option value="s1s2">{t('modals.restitution.s1s2.title')}</option>
            <option value="mms">{t('modals.restitution.mms.title')}</option>
            <option value="dynamic">{t('modals.restitution.dynamic.title')}</option>
          </select>
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row lg:overflow-hidden">
        {/* Sidebar */}
        <aside className="w-full lg:w-96 bg-white border-r border-slate-200 lg:overflow-y-auto custom-scrollbar flex-none shadow-xl z-10">
          <div className="p-6 pb-6">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">{t('common.configuration')}</p>
            
            <SettingsSection title={t('common.view_options')} defaultOpen={true}>
                <div className="space-y-3">
                    <div className="flex items-center justify-between px-2">
                        <label htmlFor="showTimeSeries" className="text-sm font-medium text-slate-700 cursor-pointer">{t('common.show_stimuli')}</label>
                        <div className="relative inline-block w-10 h-6 align-middle select-none transition duration-200 ease-in">
                            <input 
                                type="checkbox" 
                                name="showTimeSeries" 
                                id="showTimeSeries" 
                                checked={showTimeSeries}
                                onChange={() => setShowTimeSeries(!showTimeSeries)}
                                className="toggle-checkbox absolute block w-5 h-5 rounded-full bg-white border-4 appearance-none cursor-pointer checked:right-0 checked:border-emerald-500 right-5 border-slate-300 transition-all duration-200 top-0.5"
                            />
                            <label htmlFor="showTimeSeries" className="toggle-label block overflow-hidden h-6 rounded-full bg-slate-200 cursor-pointer checked:bg-emerald-500"></label>
                        </div>
                    </div>

                    {showTimeSeries && currentVariables.map(variableKey => (
                      <div key={variableKey} className="flex items-center justify-between px-2 border-l-2 border-slate-100 pl-2 ml-1">
                        <label htmlFor={`toggle-${variableKey}`} className="text-sm font-medium text-slate-600 cursor-pointer">
                          {VARIABLE_LABELS[variableKey] || variableKey}
                        </label>
                        <div className="relative inline-block w-10 h-6 align-middle select-none transition duration-200 ease-in">
                            <input 
                                type="checkbox" 
                                name={`toggle-${variableKey}`} 
                                id={`toggle-${variableKey}`} 
                                checked={!!visibleVars[variableKey]} 
                                onChange={() => toggleVariable(variableKey)}
                                className="toggle-checkbox absolute block w-5 h-5 rounded-full bg-white border-4 appearance-none cursor-pointer checked:right-0 checked:border-emerald-500 right-5 border-slate-300 transition-all duration-200 top-0.5"
                            />
                            <label htmlFor={`toggle-${variableKey}`} className="toggle-label block overflow-hidden h-6 rounded-full bg-slate-200 cursor-pointer checked:bg-emerald-500"></label>
                        </div>
                      </div>
                    ))}
                </div>
            </SettingsSection>

            <SettingsSection title={t('common.simulation_params')} defaultOpen={true}>
              {selectedModel === 'minimal' && (
                <div className="mb-4">
                  <label className="text-sm font-medium text-slate-700 mb-1 block">{t('params.cellType')}</label>
                  <select 
                    value={currentParams.cellType} 
                    onChange={(e) => handleChange(e, 'cellType')}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                  >
                    <option value="epi">{t('params.epi')}</option>
                    <option value="endo">{t('params.endo')}</option>
                    <option value="myo">{t('params.myo')}</option>
                  </select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                {Object.keys(currentParams).filter(key => key !== 'cellType').map((key) => (
                    <Input
                        key={key}
                        label={t(`params.${key}`) || key}
                        value={currentParams[key]}
                        onChange={(e) => handleChange(e, key)}
                        type="number"
                        className="mb-0"
                    />
                ))}
              </div>
            </SettingsSection>

            {selectedModel === 'minimal' && (
               <SettingsSection title={`Parâmetros (${t(`params.${currentParams.cellType}`)})`} defaultOpen={false}>
                  <div className="grid grid-cols-2 gap-2">
                     {Object.keys(minimalCustomParams[currentParams.cellType]).map(key => (
                        <Input 
                            key={key}
                            label={t(`params.${key}`) || key}
                            value={minimalCustomParams[currentParams.cellType][key]}
                            onChange={(e) => handleMinimalCustomChange(key, e.target.value)}
                            type="number"
                            className="mb-0"
                        />
                     ))}
                  </div>
               </SettingsSection>
            )}
          </div>
        </aside>

        {/* Conteúdo Principal */}
        <main className="flex-1 bg-slate-100 relative flex flex-col min-h-0">
            <div ref={chartRef} className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4 bg-slate-100">
                
                {/* Gráfico de Restituição */}
                <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 min-h-100">
                    <h3 className="text-lg font-bold text-slate-700 mb-4 pl-2 border-l-4 border-emerald-500">Curva de Restituição</h3>
                    {restitutionData.length > 0 || analyticalData.length > 0 ? (
                         <RestitutionChart data={restitutionData} analyticalData={analyticalData} />
                    ) : (
                        <div className="h-87.5 w-full flex flex-col items-center justify-center text-slate-400">
                             <i className="bi bi-graph-up text-6xl mb-4 opacity-50"></i>
                             <p>{t('common.ready')}</p>
                        </div>
                    )}
                </div>

                {/* Série Temporal (Opcional) */}
                {showTimeSeries && (
                    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 min-h-75">
                        <h3 className="text-lg font-bold text-slate-700 mb-4 pl-2 border-l-4 border-emerald-500">{t('common.stimuli')}</h3>
                        {chartData.length > 0 ? (
                             <Chart data={chartData} />
                        ) : (
                            <div className="h-62.5 w-full flex flex-col items-center justify-center text-slate-400">
                                <p>{t('common.ready')}</p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Barra de Ação Inferior */}
            <div className="bg-white border-t border-slate-200 p-4 shadow-lg z-20">
                <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-4 w-full md:w-auto">
                        <button 
                            onClick={handleSimularClick} 
                            disabled={loading}
                            className={`w-full md:w-auto rounded-full px-8 py-2 font-bold text-white shadow-md transition-transform active:scale-95 flex items-center justify-center gap-2 ${loading ? 'bg-slate-400 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700'}`}
                        >
                            {loading ? (
                                <><span className="animate-spin"><i className="bi bi-arrow-repeat"></i></span> {t('common.simulating')}</>
                            ) : (
                                <><i className="bi bi-play-fill text-xl"></i> {t('common.simulate')}</>
                            )}
                        </button>

                        {/* Botão de Exportar */}
                        {(restitutionData.length > 0 || (showTimeSeries && chartData.length > 0)) && (
                          <ExportButton 
                              onClick={handleExport}
                              label={t('common.export_result')}
                          />
                        )}
                    </div>
                    
                    <Button onClick={() => setIsInfoModalOpen(true)} className="bg-slate-100 text-slate-600 hover:bg-slate-200 p-2 rounded-lg" title={t('common.more_info')}>
                        <i className="bi bi-info-circle text-lg"></i> <span className="md:hidden ml-2">{t('common.more_info')}</span>
                    </Button>
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

export default RestitutionCurvePage;