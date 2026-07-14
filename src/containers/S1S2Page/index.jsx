import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Chart from '../../components/Chart';
import Input from '../../components/Input';
import Button from '../../components/Button';
import Modal from '../../components/Modal';
import ExportButton from '../../components/ExportButton';
import SimulationWorker from '../../simulation_s1_s2.worker.js?worker';
import MinimalWorker from '../../simulation_minimal_0d.worker.js?worker';
import TenTusscherWorker from '../../simulation_tentusscher_0d.worker.js?worker';
import ExportModal from '../../components/ExportModal';
import { useTranslation } from 'react-i18next';
import { exportToPng } from '../../utils/export';
import './styles.css';
import { t } from 'i18next';

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

const MetricCard = ({ label, value, unit }) => (
  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex flex-col items-center justify-center shadow-sm hover:shadow-md transition-shadow">
    <span className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">{label}</span>
    <div className="flex items-baseline gap-1">
      <span className="text-xl font-bold text-emerald-700">
        {value !== null && value !== undefined ? value.toFixed(2) : '-'}
      </span>
      <span className="text-xs text-slate-400 font-medium">{unit}</span>
    </div>
  </div>
);

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

const DEFAULT_EDITABLE_PARAMS = {
  ms: {
      despolarização: 0.3,
      repolarização: 6.0,
      recuperação: 120.0,
      inativação: 80.0,
      gate: 0.13,
      S1: 300,
      S2: 240,
      intervalo: 50,
      duração: 1.0,
      amplitude: 1.0,
      dt: 0.1,
      v_inicial: 0.0,
      h_inicial: 1.0,
      num_estimulos_s1: 8,
      downsamplingFactor: 100,
  },
  minimal: {
      cellType: 'epi',
      S1: 350,
      S2: 280,
      intervalo: 50,
      duração: 1.0,
      amplitude: 1.0,
      dt: 0.1,
      num_estimulos_s1: 5,
      downsamplingFactor: 50,
  },
  tentusscher: {
      cellType: 'epi',
      S1: 400,
      S2: 300,
      intervalo: 50,
      duração: 1.0,
      amplitude: -52.0,
      dt: 0.02,
      num_estimulos_s1: 5,
      downsamplingFactor: 50,
      isIschemia: false,
      Ko_ischemia: 8.0,
      ATPi: 3.0,
      GNa_scale: 0.75,
      GCaL_scale: 0.75
  }
};

const MODEL_VARIABLES = {
  ms: ['v', 'h'],
  minimal: ['v', 'gate_v', 'gate_w', 'gate_s'],
  tentusscher: ['v', 'Cai', 'Nai', 'Ki', 'estimulo']
};

const VARIABLE_LABELS = {
  v: t('chart.potential_unit'),
  h: 'Gate h',
  gate_v: 'Gate v',
  gate_w: 'Gate w',
  gate_s: 'Gate s',
  Cai: 'Cai (mM)',
  Nai: 'Nai (mM)',
  Ki: 'Ki (mM)',
  estimulo: 'Estímulo'
};

const S1S2Page = ({ onBack }) => {
  const { t } = useTranslation();
  const [data, setData] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [worker, setWorker] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('basic');
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  
  const [selectedModel, setSelectedModel] = useState('ms');
  const [minimalCustomParams, setMinimalCustomParams] = useState(DEFAULT_MINIMAL_PARAMS);
  const chartRef = useRef(null);
  const [visibleVars, setVisibleVars] = useState({ v: true, h: true });

  const [editableParams, setEditableParams] = useState(DEFAULT_EDITABLE_PARAMS);

  useEffect(() => {
    let simulationWorker;
    if (selectedModel === 'minimal') {
      simulationWorker = new MinimalWorker();
      setVisibleVars({ v: true, gate_v: true, gate_w: true, gate_s: true });
    } else if (selectedModel === 'tentusscher') {
      simulationWorker = new TenTusscherWorker();
      setVisibleVars({ v: true, Cai: false, Nai: false, Ki: false, estimulo: true });
    } else {
      simulationWorker = new SimulationWorker();
      setVisibleVars({ v: true, h: true });
    }
    setWorker(simulationWorker);

    simulationWorker.onmessage = (e) => {
      if (e.data.metrics) {
        setData(e.data.data);
        setMetrics(e.data.metrics);
      } else {
        setData(e.data);
        setMetrics(null);
      }
      setLoading(false);
    };

    return () => {
      simulationWorker.terminate();
    };
  }, [selectedModel]);

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
    let value = e.target.value;
    if (name === 'isIschemia') value = e.target.checked;
    else if (name !== 'cellType') value = parseFloat(value);
    setEditableParams((prevParams) => ({ 
      ...prevParams, 
      [selectedModel]: {
        ...prevParams[selectedModel],
        [name]: value
      } 
    }));
  }, [selectedModel]);

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

  const handleSimularClick = useCallback(() => {
    if (worker) {
      setLoading(true);
      setMetrics(null);
      
      const currentParams = editableParams[selectedModel];

      // Pega os dados
      const payload = { 
        ...currentParams,
        BCL_S1: currentParams.S1,
        intervalo_S2: currentParams.S2,
        num_estimulos_s1: currentParams.num_estimulos_s1,
        inicio: 50
      };

      if (selectedModel === 'minimal') {
        payload.protocol = 's1s2';
        payload.minimalCellParams = minimalCustomParams;
      } else if (selectedModel === 'tentusscher') {
        payload.protocol = 's1s2';
        payload.s2_start = payload.inicio + ((payload.num_estimulos_s1 - 1) * payload.BCL_S1) + payload.intervalo_S2;
      }
      
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
    exportToPng(chartRef, `s1s2_${selectedModel}`);
  }, [selectedModel]);

  const handleReset = useCallback(() => {
    setEditableParams(DEFAULT_EDITABLE_PARAMS);
    setMinimalCustomParams(DEFAULT_MINIMAL_PARAMS);
    setData([]);
    setMetrics(null);
  }, []);

  const currentParams = editableParams[selectedModel];
  const currentVariables = MODEL_VARIABLES[selectedModel];

  // Modal de informações
  const renderModalContent = () => {
    const modelKey = selectedModel;

    if (activeTab === 'basic') {
      return (
        <div className="space-y-4 animate-fadeIn">
          <h3 className="text-xl font-bold text-slate-700">{t(`modals.s1s2.${modelKey}.basic.title`)}</h3>
          <p className="text-slate-600 leading-relaxed text-justify">{t(`modals.s1s2.${modelKey}.basic.desc`)}</p>
          
          <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-4 mt-4">
             <h4 className="font-semibold text-emerald-800 mb-2">
                <i className="bi bi-lightbulb mr-2"></i>
                {t(`modals.s1s2.${modelKey}.basic.goal`)}
             </h4>
             <p className="text-sm text-emerald-700 leading-relaxed text-justify">
                {t(`modals.s1s2.${modelKey}.basic.goal_desc`)}
             </p>
          </div>
        </div>
      );
    }

    if (activeTab === 'advanced') {
      return (
        <div className="space-y-4 animate-fadeIn">
          <h3 className="text-xl font-bold text-slate-700">{t(`modals.s1s2.${modelKey}.advanced.title`)}</h3>
          <p className="text-slate-600 leading-relaxed text-justify">{t(`modals.s1s2.${modelKey}.advanced.desc`)}</p>
          
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
             <h4 className="font-semibold text-slate-700 mb-2">{t(`modals.s1s2.${modelKey}.advanced.kinetics`)}</h4>
             <p className="text-sm text-slate-600 text-justify">{t(`modals.s1s2.${modelKey}.advanced.kinetics_desc`)}</p>
          </div>

          <div className="mt-6 border-t border-slate-200 pt-4">
             <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">{t('modals.references')}</h4>
             <p className="text-xs text-slate-500 italic">{t(`modals.s1s2.${modelKey}.advanced.ref`)}</p>
          </div>
        </div>
      );
    }

    if (activeTab === 'math') {
      return (
        <div className="space-y-4 animate-fadeIn">
          <h3 className="text-xl font-bold text-slate-700">{t(`modals.s1s2.${modelKey}.math.title`)}</h3>
          <p className="text-slate-600 text-sm">{t(`modals.s1s2.${modelKey}.math.desc`)}</p>
          
          <div className="bg-slate-50 border border-slate-200 border-l-4 border-l-emerald-500 text-slate-700 p-4 rounded-r-lg font-mono text-sm space-y-2 overflow-x-auto custom-scrollbar">
             {modelKey === 'ms' ? (
                <>
                   <p>{t('modals.single.ms.math.eq_v')}</p>
                   <p>{t('modals.single.ms.math.eq_h1')}</p>
                   <p>{t('modals.single.ms.math.eq_h2')}</p>
                </>
             ) : modelKey === 'minimal' ? (
                <>
                   <p>{t('modals.single.minimal.math.eq_u')}</p>
                   <p>{t('modals.single.minimal.math.eq_v')}</p>
                   <p>{t('modals.single.minimal.math.eq_w')}</p>
                   <p>{t('modals.single.minimal.math.eq_s')}</p>
                </>
             ) : (
                <>
                   <p>{t('modals.single.tentusscher.math.eq_v')}</p>
                   <p>{t('modals.single.tentusscher.math.eq_ion')}</p>
                   <p>{t('modals.single.tentusscher.math.eq_gates')}</p>
                </>
             )}
          </div>
          <p className="text-sm text-slate-600 italic mt-2">{t(`modals.s1s2.${modelKey}.math.stim_term`)}</p>

          <h4 className="font-bold text-slate-700 mt-6">{t(`modals.s1s2.${modelKey}.math.numerical`)}</h4>
          <p className="text-sm text-slate-600 text-justify">{t(`modals.s1s2.${modelKey}.math.numerical_desc`)}</p>
        </div>
      );
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-auto lg:overflow-hidden">
      
      {/* Header */}
      <header className="bg-white border-b border-slate-200 h-16 flex-none flex items-center justify-between px-6 shadow-sm z-20 sticky top-0 lg:relative">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-full transition-colors">
            <i className="bi bi-arrow-left text-xl"></i>
          </button>
          <h1 className="text-xl font-bold text-slate-800 hidden sm:block">{t('home.models.s1s2.title')}</h1>
        </div>
        <div className="flex items-center gap-3">
            <span className="text-sm text-slate-500 hidden sm:block">{t('common.select_model')}:</span>
            <select 
              value={selectedModel} 
              onChange={(e) => { setData([]); setMetrics(null); setSelectedModel(e.target.value); }} 
              className="bg-slate-100 border-none text-sm font-medium text-slate-700 py-2 px-4 rounded-lg cursor-pointer focus:ring-2 focus:ring-emerald-500"
            >
                <option value="ms">Mitchell-Schaeffer</option>
                <option value="minimal">{t('modals.restitution.minimal.title')}</option>
                <option value="tentusscher">{t('common.tentusscher_model')}</option>
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
                {currentVariables.map(variableKey => (
                  <div key={variableKey} className="flex items-center justify-between px-2">
                    <label htmlFor={`toggle-${variableKey}`} className="text-sm font-medium text-slate-700 cursor-pointer">
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
              <div className="grid grid-cols-2 gap-3">
                 <Input label={t('params.dt')} value={currentParams.dt} onChange={(e) => handleChange(e, 'dt')} type="number" />
                 <Input label="Downsampling" value={currentParams.downsamplingFactor} onChange={(e) => handleChange(e, 'downsamplingFactor')} type="number" />
              </div>
            </SettingsSection>

            <SettingsSection title={t('home.models.s1s2.title')} defaultOpen={true}>
              <div className="grid grid-cols-2 gap-3">
                 <Input label={t('params.BCL_S1')} value={currentParams.S1} onChange={(e) => handleChange(e, 'S1')} type="number" />
                 <Input label={t('params.BCL_S2')} value={currentParams.S2} onChange={(e) => handleChange(e, 'S2')} type="number" />
                 <Input label={t('params.duracao')} value={currentParams.duração} onChange={(e) => handleChange(e, 'duração')} type="number" />
                 <Input label={t('params.amplitude')} value={currentParams.amplitude} onChange={(e) => handleChange(e, 'amplitude')} type="number" />
                 <Input label={t('params.num_estimulos_s1')} value={currentParams.num_estimulos_s1} onChange={(e) => handleChange(e, 'num_estimulos_s1')} type="number" />
              </div>
            </SettingsSection>

            {selectedModel === 'ms' ? (
                <SettingsSection title="Mitchell-Schaeffer" defaultOpen={true}>
                    <div className="grid grid-cols-2 gap-3">
                        <Input label={t('params.Tau_in')} value={currentParams.despolarização} onChange={(e) => handleChange(e, 'despolarização')} type="number" />
                        <Input label={t('params.Tau_out')} value={currentParams.repolarização} onChange={(e) => handleChange(e, 'repolarização')} type="number" />
                        <Input label={t('params.Tau_open')} value={currentParams.recuperação} onChange={(e) => handleChange(e, 'recuperação')} type="number" />
                        <Input label={t('params.Tau_close')} value={currentParams.inativação} onChange={(e) => handleChange(e, 'inativação')} type="number" />
                        <Input label={t('params.gate')} value={currentParams.gate} onChange={(e) => handleChange(e, 'gate')} type="number" />
                        <Input label={t('params.v_inicial')} value={currentParams.v_inicial} onChange={(e) => handleChange(e, 'v_inicial')} type="number" />
                        <Input label={t('params.h_inicial')} value={currentParams.h_inicial} onChange={(e) => handleChange(e, 'h_inicial')} type="number" />
                    </div>
                </SettingsSection>
            ) : (
                <SettingsSection title={selectedModel === 'minimal' ? t('modals.restitution.minimal.title') : t('common.tentusscher_model')} defaultOpen={true}>
                     <div className="mb-3">
                         <label className="text-sm font-medium text-slate-700">{t('params.cellType')}</label>
                         <select 
                            value={currentParams.cellType} 
                            onChange={(e) => handleChange(e, 'cellType')} 
                            className="w-full mt-1 px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm"
                         >
                            <option value="epi">{t('params.epi')}</option>
                            <option value="endo">{t('params.endo')}</option>
                            <option value="myo">{t('params.myo')}</option>
                         </select>
                     </div>
                     {selectedModel === 'minimal' && (
                         <div className="mt-4 pt-2 border-t border-slate-100">
                            <p className="text-xs font-semibold text-slate-500 mb-2">{t('common.custom_params')} ({t(`params.${currentParams.cellType}`)})</p>
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
                         </div>
                     )}
                </SettingsSection>
            )}
            
            {selectedModel === 'tentusscher' && (
              <SettingsSection title={t('params.ischemia') || 'Isquemia'} defaultOpen={currentParams.isIschemia}>
                  <div className="flex items-center justify-between mb-4">
                     <span className="text-sm font-medium text-slate-700">{t('params.enable_ischemia') || 'Ativar Isquemia'}</span>
                     <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          className="sr-only peer" 
                          checked={currentParams.isIschemia || false} 
                          onChange={(e) => handleChange({ target: { checked: e.target.checked } }, 'isIschemia')} 
                        />
                        <div className="w-11 h-6 bg-slate-200 rounded-full peer peer-focus:ring-4 peer-focus:ring-emerald-300 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                     </label>
                  </div>
                  {currentParams.isIschemia && (
                     <>
                        <Input label={t('params.atpi') || 'ATPi (mM)'} value={currentParams.ATPi} onChange={(e) => handleChange(e, 'ATPi')} type="number" step="0.1" />
                        <Input label={t('params.ko_ischemia') || 'Ko isquêmico (mM)'} value={currentParams.Ko_ischemia} onChange={(e) => handleChange(e, 'Ko_ischemia')} type="number" step="0.1" />
                        <Input label={t('params.gna_scale') || 'Escala GNa'} value={currentParams.GNa_scale} onChange={(e) => handleChange(e, 'GNa_scale')} type="number" step="0.01" />
                        <Input label={t('params.gcal_scale') || 'Escala GCaL'} value={currentParams.GCaL_scale} onChange={(e) => handleChange(e, 'GCaL_scale')} type="number" step="0.01" />
                     </>
                  )}
              </SettingsSection>
            )}
          </div>
        </aside>

        {/* Conteúdo Principal */}
        <main className="flex-1 bg-slate-100 relative flex flex-col min-h-0">
          <div className="flex-1 flex items-center justify-center p-4 relative min-h-[50vh] lg:min-h-0">
            <div ref={chartRef} className="relative shadow-lg rounded-lg overflow-hidden bg-white w-full h-full border border-slate-200 p-4 flex flex-col">
               {chartData.length > 0 ? (
                  <>
                      <div className="flex-1 min-h-0">
                          <Chart data={chartData} />
                      </div>
                      {metrics && (
                          <div className="mt-4 pt-4 border-t border-slate-100 animate-fade-in">
                            <h4 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                                <i className="bi bi-speedometer2"></i> {t('chart.metrics')}
                            </h4>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <MetricCard label={t('chart.dvdtMax')} value={metrics.dvdtMax} unit={selectedModel === 'ms' ? '1/ms' : ''} />
                                <MetricCard label="APD 90" value={metrics.apd} unit="ms" />
                            </div>
                          </div>
                      )}
                  </>
               ) : (
                  <div className="h-full w-full flex flex-col items-center justify-center text-slate-400">
                      <i className="bi bi-activity text-6xl mb-4 opacity-50"></i>
                      <p>{t('common.ready')}</p>
                  </div>
               )}
            </div>
          </div>

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

                    <button
                        onClick={handleReset}
                        className="rounded-full px-6 py-2 font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors shadow-sm flex items-center justify-center gap-2"
                        title={t('common.reset')}
                    >
                        <i className="bi bi-arrow-counterclockwise text-lg"></i> <span className="hidden sm:inline">{t('common.reset')}</span>
                    </button>

                    <ExportButton onClick={() => setIsExportModalOpen(true)} />
                    <ExportModal
                        mode="0d" 
                        isOpen={isExportModalOpen} 
                        onClose={() => setIsExportModalOpen(false)}
                        onExportPng={() => exportToPng(chartRef, 's1s2_protocol_plot')}
                        onExportData={() => export0DToCSV(data, 's1s2_protocol_data')}
                        dataType="CSV" 
                    />
                </div>
                
                <Button onClick={() => setIsInfoModalOpen(true)} className="bg-slate-100 text-slate-600 hover:bg-slate-200 p-2 rounded-lg" title={t('common.more_info')}>
                    <i className="bi bi-info-circle text-lg"></i> <span className="md:hidden ml-2">{t('common.more_info')}</span>
                </Button>
            </div>
          </div>
        </main>
      </div>

      {/* Modal de Informações */}
      <Modal isOpen={isInfoModalOpen} onClose={() => setIsInfoModalOpen(false)}>
        <div className="info-modal-content max-h-[80vh] flex flex-col bg-white">
            
            <div className="flex-none border-b border-slate-200 mb-4 px-2">
               <h2 className="text-2xl font-bold text-emerald-800 mb-4">
                  {selectedModel === 'ms' ? 'Mitchell-Schaeffer' : selectedModel === 'minimal' ? 'Minimal Model' : 'Ten Tusscher (2004)'}
               </h2>
               <div className="flex gap-6 overflow-x-auto custom-scrollbar">
                  {['basic', 'advanced', 'math'].map((tab) => (
                     <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`pb-3 text-sm font-semibold transition-colors whitespace-nowrap ${
                           activeTab === tab 
                           ? 'border-b-2 border-emerald-500 text-emerald-700' 
                           : 'text-slate-500 hover:text-slate-700'
                        }`}
                     >
                        {t(`modals.tabs.${tab}`)}
                     </button>
                  ))}
               </div>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar pb-4">
                {renderModalContent()}
            </div>
        </div>
      </Modal>
    </div>
  );
};

export default S1S2Page;