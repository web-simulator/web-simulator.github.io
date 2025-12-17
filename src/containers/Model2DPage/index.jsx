import { useState, useEffect, useCallback } from 'react';
import HeatmapChart from '../../components/HeatmapChart';
import Input from '../../components/Input';
import Button from '../../components/Button';
import Chart from '../../components/Chart';
import Modal from '../../components/Modal';
import SimulationWorker from '../../simulation_2d.worker.js?worker';
import MinimalWorker from '../../simulation_minimal_2d.worker.js?worker';
import { useTranslation } from 'react-i18next';

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

const DEFAULT_MINIMAL_PARAMS = {
  endo: { u_o: 0.0, u_u: 1.56, theta_v: 0.3, theta_w: 0.13, theta_vminus: 0.2, theta_o: 0.006, tau_v1minus: 75.0, tau_v2minus: 10.0, tau_vplus: 1.4506, tau_w1minus: 6.0, tau_w2minus: 140.0, k_wminus: 200.0, u_wminus: 0.016, tau_wplus: 280.0, tau_fi: 0.15, tau_o1: 470.0, tau_o2: 6.0, tau_so1: 40.0, tau_so2: 1.2, k_so: 2.0, u_so: 0.65, tau_s1: 2.7342, tau_s2: 2.0, k_s: 2.0994, u_s: 0.9087, tau_si: 2.9013, tau_winf: 0.0273, w_infstar: 0.78 },
  myo: { u_o: 0.0, u_u: 1.61, theta_v: 0.3, theta_w: 0.13, theta_vminus: 0.1, theta_o: 0.005, tau_v1minus: 80.0, tau_v2minus: 1.4506, tau_vplus: 1.4506, tau_w1minus: 70.0, tau_w2minus: 8.0, k_wminus: 200.0, u_wminus: 0.016, tau_wplus: 280.0, tau_fi: 0.117, tau_o1: 410.0, tau_o2: 7.0, tau_so1: 91.0, tau_so2: 0.8, k_so: 2.1, u_so: 0.6, tau_s1: 2.7342, tau_s2: 4.0, k_s: 2.0994, u_s: 0.9087, tau_si: 3.3849, tau_winf: 0.01, w_infstar: 0.5 },
  epi: { u_o: 0.0, u_u: 1.55, theta_v: 0.3, theta_w: 0.13, theta_vminus: 0.006, theta_o: 0.006, tau_v1minus: 60.0, tau_v2minus: 1150.0, tau_vplus: 1.4506, tau_w1minus: 60.0, tau_w2minus: 15.0, k_wminus: 65.0, u_wminus: 0.03, tau_wplus: 200.0, tau_fi: 0.165, tau_o1: 400.0, tau_o2: 6.0, tau_so1: 30.0181, tau_so2: 0.9957, k_so: 2.0458, u_so: 0.65, tau_s1: 2.7342, tau_s2: 16.0, k_s: 2.0994, u_s: 0.9087, tau_si: 1.8875, tau_winf: 0.07, w_infstar: 0.94 }
};

const Model2DPage = ({ onBack }) => {
  const { t } = useTranslation();

  // Evita problemas caso alguma tradução falte
  const safeList = (key) => {
    const res = t(key, { returnObjects: true });
    if (Array.isArray(res)) return res;
    if (typeof res === 'object' && res !== null) return Object.values(res);
    return [];
  };

  // Estados de Controle
  const [worker, setWorker] = useState(null);
  const [calculating, setCalculating] = useState(false); 
  const [simulationResult, setSimulationResult] = useState(null); 
  const [progress, setProgress] = useState(0);
  const [remainingTime, setRemainingTime] = useState(null);
  
  // Player
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(50); 

  // Configurações
  const [selectedModel, setSelectedModel] = useState('ms'); 
  const [minimalCustomParams, setMinimalCustomParams] = useState(DEFAULT_MINIMAL_PARAMS);
  const [selectedPoint, setSelectedPoint] = useState(null);
  const [isChartModalOpen, setIsChartModalOpen] = useState(false);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);

  // Parâmetros
  const [params, setParams] = useState({
    L: 10.0, N: 100, dt: 0.1, duration: 1000, stride: 10,
    sigma_l: 0.004, sigma_t: 0.001, angle: 0,
    tau_in: 0.3, tau_out: 6.0, tau_open: 120.0, tau_close: 140.0, v_gate: 0.13,
    cellType: 'epi',
    fibrosis: false, fibrosisType: 'compact', fibrosisDistribution: 'random', fibrosisDensity: 10,
    fibrosisSeed: 12345, fibrosisConductivity: 0.0, fibrosisShape: 'rectangle', fibrosisBorderZone: 0.0,
    fibrosisRect: { x1: 2.0, y1: 2.0, x2: 5.0, y2: 5.0 },
    fibrosisCircle: { cx: 5.0, cy: 5.0, radius: 2.0 },
    fibrosisRegion: { x1: 2.0, y1: 2.0, x2: 5.0, y2: 5.0 }, 
    transmurality: false, endo_tau: 80.0, mid_tau: 140.0, epi_tau: 70.0, mid_start: 30, epi_start: 60, 
  });

  const [stimuli, setStimuli] = useState([
    {
      id: 1, 
      startTime: 0, 
      interval: 0, 
      duration: 2, amplitude: 1.0, 
      shape: 'rectangle',
      rectParams: { x1: 0.0, y1: 0.0, x2: 0.5, y2: 10.0 }, 
      circleParams: { cx: 5.0, cy: 5.0, radius: 0.5 } 
    },
    {
      id: 2,
      startTime: 0, 
      interval: 320, 
      duration: 2,
      amplitude: 1.0,
      shape: 'rectangle',
      rectParams: { x1: 0.0, y1: 5.0, x2: 5.0, y2: 10.0 }, 
      circleParams: { cx: 8.0, cy: 3.0, radius: 1 } 
    }
  ]);

  // Inicializa Worker
  useEffect(() => {
    let simWorker;
    if (selectedModel === 'minimal') simWorker = new MinimalWorker();
    else simWorker = new SimulationWorker();
    
    simWorker.onmessage = (e) => {
      const { type, value, remaining, frames, times, fibrosis, N, totalFrames } = e.data;
      
      if (type === 'progress') {
        setProgress(value);
        if (remaining !== undefined) setRemainingTime(remaining);
      } else if (type === 'result') {
        setSimulationResult({ frames, times, fibrosis, N, totalFrames });
        setCalculating(false);
        setCurrentFrame(0);
        setIsPlaying(true);
      }
    };
    setWorker(simWorker);
    return () => simWorker.terminate();
  }, [selectedModel]);

  // Loop de Animação
  useEffect(() => {
    let animationFrameId;
    let lastTime = 0;
    const interval = Math.max(0, (100 - playbackSpeed) * 2);

    const animate = (time) => {
      if (!isPlaying || !simulationResult) return;

      if (time - lastTime >= interval) {
        setCurrentFrame((prev) => {
          const next = prev + 1;
          return next >= simulationResult.totalFrames ? 0 : next; 
        });
        lastTime = time;
      }
      
      animationFrameId = requestAnimationFrame(animate);
    };

    if (isPlaying && simulationResult) animationFrameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrameId);
  }, [isPlaying, simulationResult, playbackSpeed]);

  // Atualiza Parâmetros
  const handleChange = useCallback((e, name) => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setParams(prev => ({ ...prev, [name]: val }));
  }, []);

  const handleFibrosisNestedChange = (shapeType, key, value) => {
    setParams(prev => ({
        ...prev,
        [shapeType]: { ...prev[shapeType], [key]: value }
    }));
  };

  const handleMinimalCustomChange = (param, value) => {
    const activeType = params.cellType;
    setMinimalCustomParams(prev => ({
      ...prev,
      [activeType]: { ...prev[activeType], [param]: value }
    }));
  };

  const updateStimulus = (id, field, value) => {
    setStimuli(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
  };
  
  const updateStimulusNested = (id, parent, key, value) => {
    setStimuli(prev => prev.map(s => s.id === id ? { 
        ...s, 
        [parent]: { ...s[parent], [key]: value } 
    } : s));
  };

  const addStimulus = () => {
    setStimuli(prev => [...prev, {
        id: Date.now(), startTime: 0, interval: 200, duration: 2, amplitude: 1.0, shape: 'rectangle',
        rectParams: { x1: 0, y1: 0, x2: 1, y2: 1 }, circleParams: { cx: 5, cy: 5, radius: 1 }
    }]);
  };

  const removeStimulus = (id) => {
    setStimuli(prev => prev.filter(s => s.id !== id));
  };

  const handleStart = () => {
    if (!worker) return;
    setCalculating(true); setSimulationResult(null); setProgress(0); setRemainingTime(null); setIsPlaying(false);
    
    const num = (v) => parseFloat(v) || 0;
    const int = (v) => parseInt(v, 10) || 0;

    const safeParams = {
        ...params,
        L: num(params.L), N: int(params.N), dt: num(params.dt), duration: num(params.duration), stride: int(params.stride),
        sigma_l: num(params.sigma_l), sigma_t: num(params.sigma_t), angle: num(params.angle),
        tau_in: num(params.tau_in), tau_out: num(params.tau_out), tau_open: num(params.tau_open), tau_close: num(params.tau_close), v_gate: num(params.v_gate),
        fibrosisDensity: num(params.fibrosisDensity), fibrosisSeed: int(params.fibrosisSeed), fibrosisConductivity: num(params.fibrosisConductivity), fibrosisBorderZone: num(params.fibrosisBorderZone),
        endo_tau: num(params.endo_tau), mid_tau: num(params.mid_tau), epi_tau: num(params.epi_tau), mid_start: num(params.mid_start), epi_start: num(params.epi_start),
    };

    const safeFibrosisRect = { x1: num(params.fibrosisRect.x1), y1: num(params.fibrosisRect.y1), x2: num(params.fibrosisRect.x2), y2: num(params.fibrosisRect.y2) };
    const safeFibrosisCircle = { cx: num(params.fibrosisCircle.cx), cy: num(params.fibrosisCircle.cy), radius: num(params.fibrosisCircle.radius) };
    const safeFibrosisRegion = { x1: num(params.fibrosisRegion.x1), y1: num(params.fibrosisRegion.y1), x2: num(params.fibrosisRegion.x2), y2: num(params.fibrosisRegion.y2) };

    const safeStimuli = stimuli.map(s => ({
        ...s,
        startTime: num(s.startTime), interval: num(s.interval), duration: num(s.duration), amplitude: num(s.amplitude),
        rectParams: { x1: num(s.rectParams.x1), y1: num(s.rectParams.y1), x2: num(s.rectParams.x2), y2: num(s.rectParams.y2) },
        circleParams: { cx: num(s.circleParams.cx), cy: num(s.circleParams.cy), radius: num(s.circleParams.radius) }
    }));

    const safeMinimalParams = {};
    Object.keys(minimalCustomParams).forEach(type => {
        safeMinimalParams[type] = {};
        Object.keys(minimalCustomParams[type]).forEach(k => { safeMinimalParams[type][k] = num(minimalCustomParams[type][k]); });
    });

    const payload = {
      modelType: selectedModel,
      ...safeParams,
      Tau_in: safeParams.tau_in, Tau_out: safeParams.tau_out, Tau_open: safeParams.tau_open, Tau_close: safeParams.tau_close, gate: safeParams.v_gate,
      totalTime: safeParams.duration, downsamplingFactor: safeParams.stride,
      
      fibrosisParams: {
        enabled: params.fibrosis, type: params.fibrosisType, distribution: params.fibrosisDistribution, shape: params.fibrosisShape,
        conductivity: safeParams.fibrosisConductivity, density: safeParams.fibrosisDensity / 100.0, seed: safeParams.fibrosisSeed, borderZone: safeParams.fibrosisBorderZone,
        rectParams: safeFibrosisRect, circleParams: safeFibrosisCircle, regionParams: safeFibrosisRegion,
      },
      transmuralityParams: {
        enabled: params.transmurality, endo_tau: safeParams.endo_tau, mid_tau: safeParams.mid_tau, epi_tau: safeParams.epi_tau, mid_start: safeParams.mid_start, epi_start: safeParams.epi_start
      },
      stimuli: safeStimuli, minimalCellParams: safeMinimalParams
    };

    worker.postMessage(payload);
  };

  const handleStop = () => {
      if (worker) worker.terminate();
      let simWorker = selectedModel === 'minimal' ? new MinimalWorker() : new SimulationWorker();
      simWorker.onmessage = (e) => {
          const { type, value, remaining, frames, times, fibrosis, N, totalFrames } = e.data;
          if (type === 'progress') { setProgress(value); if (remaining) setRemainingTime(remaining); }
          else if (type === 'result') { setSimulationResult({ frames, times, fibrosis, N, totalFrames }); setCalculating(false); setCurrentFrame(0); setIsPlaying(true); }
      };
      setWorker(simWorker); setCalculating(false); setProgress(0);
  };

  let currentChartData = null;
  let currentFibrosisMap = null;
  let N_dimension = parseInt(params.N, 10) || 100;

  if (simulationResult) {
      const { frames, fibrosis, N } = simulationResult;
      N_dimension = N;
      const start = currentFrame * N * N;
      const end = start + N * N;
      currentChartData = frames.subarray(start, end);
      currentFibrosisMap = fibrosis; 
  }

  const getTimeseriesForPoint = () => {
    if (!selectedPoint || !simulationResult) return [];
    const { frames, times, N, totalFrames } = simulationResult;
    const idx = selectedPoint.i * N + selectedPoint.j;
    const timeseries = [];
    for(let f = 0; f < totalFrames; f++) {
        timeseries.push({ tempo: times[f].toFixed(1), v: frames[f * N * N + idx] });
    }
    return timeseries;
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden">
      
      <header className="bg-white border-b border-slate-200 h-16 flex-none flex items-center justify-between px-6 shadow-sm z-20">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-full transition-colors">
            <i className="bi bi-arrow-left text-xl"></i>
          </button>
          <h1 className="text-xl font-bold text-slate-800 hidden sm:block">{t('home.models.model_2d.title')}</h1>
        </div>
        <div className="flex items-center gap-3">
            <span className="text-sm text-slate-500 hidden sm:block">{t('common.select_model')}:</span>
            <select value={selectedModel} onChange={(e) => { setSimulationResult(null); setSelectedModel(e.target.value); }} className="bg-slate-100 border-none text-sm font-medium text-slate-700 py-2 px-4 rounded-lg cursor-pointer focus:ring-2 focus:ring-emerald-500">
                <option value="ms">{t('common.ms_model')}</option>
                <option value="minimal">{t('common.minimal_model')}</option>
            </select>
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        <aside className="w-full lg:w-96 bg-white border-r border-slate-200 overflow-y-auto custom-scrollbar flex-none shadow-xl z-10">
          <div className="p-6 pb-24 lg:pb-6">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">{t('common.configuration')}</p>

            <SettingsSection title={t('common.geometry')} defaultOpen={true}>
              <div className="grid grid-cols-2 gap-3">
                <Input label={t('params.N')} value={params.N} onChange={(e) => handleChange(e, 'N')} type="number" />
                <Input label={t('params.L')} value={params.L} onChange={(e) => handleChange(e, 'L')} type="number" />
                <Input label={t('params.dt')} value={params.dt} onChange={(e) => handleChange(e, 'dt')} type="number" />
                <Input label={t('params.tempo_total')} value={params.duration} onChange={(e) => handleChange(e, 'duration')} type="number" />
                <Input label={t('common.save_stride')} value={params.stride} onChange={(e) => handleChange(e, 'stride')} type="number" className="col-span-2" />
              </div>
            </SettingsSection>

            <SettingsSection title={t('common.tissue_properties')} defaultOpen={true}>
                <Input label={t('params.sigma_l')} value={params.sigma_l} onChange={(e) => handleChange(e, 'sigma_l')} type="number" />
                <Input label={t('params.sigma_t')} value={params.sigma_t} onChange={(e) => handleChange(e, 'sigma_t')} type="number" />
                <Input label={t('params.angle')} value={params.angle} onChange={(e) => handleChange(e, 'angle')} type="number" />
            </SettingsSection>

            {selectedModel === 'ms' ? (
                <SettingsSection title={t('common.ms_model')}>
                    <div className="grid grid-cols-2 gap-3">
                        <Input label={t('params.Tau_in')} value={params.tau_in} onChange={(e) => handleChange(e, 'tau_in')} type="number" />
                        <Input label={t('params.Tau_out')} value={params.tau_out} onChange={(e) => handleChange(e, 'tau_out')} type="number" />
                        <Input label={t('params.Tau_open')} value={params.tau_open} onChange={(e) => handleChange(e, 'tau_open')} type="number" />
                        <Input label={t('params.Tau_close')} value={params.tau_close} onChange={(e) => handleChange(e, 'tau_close')} type="number" />
                        <Input label={t('params.gate')} value={params.v_gate} onChange={(e) => handleChange(e, 'v_gate')} type="number" />
                    </div>
                </SettingsSection>
            ) : (
                <SettingsSection title={t('common.minimal_model')}>
                     {!params.transmurality && (
                         <div className="mb-3">
                             <label className="text-sm font-medium text-slate-700">{t('common.cell_type')}</label>
                             <select value={params.cellType} onChange={(e) => handleChange(e, 'cellType')} className="w-full mt-1 px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm">
                                <option value="epi">{t('params.epi')}</option>
                                <option value="endo">{t('params.endo')}</option>
                                <option value="myo">{t('params.myo')}</option>
                             </select>
                         </div>
                     )}
                     <div className="mt-4 pt-2 border-t border-slate-100">
                        <p className="text-xs font-semibold text-slate-500 mb-2">{t('common.custom_params')} ({t(`params.${params.cellType}`)})</p>
                        <div className="grid grid-cols-2 gap-2">
                             {Object.keys(minimalCustomParams[params.cellType]).slice(0, 6).map(key => (
                                <Input key={key} label={t(`params.${key}`) || key} value={minimalCustomParams[params.cellType][key]} onChange={(e) => handleMinimalCustomChange(key, e.target.value)} type="number" className="mb-0" />
                             ))}
                        </div>
                     </div>
                </SettingsSection>
            )}

            <SettingsSection title={t('common.stimuli')}>
               {stimuli.map((stim, idx) => (
                   <div key={stim.id} className="mb-4 p-3 bg-slate-50 rounded border border-slate-200 relative">
                       <div className="flex justify-between items-center mb-2">
                           <span className="text-sm font-bold text-slate-700">{t('common.stimulus')} {idx + 1}</span>
                           {idx > 0 && <button onClick={() => removeStimulus(stim.id)} className="text-red-500 hover:text-red-700"><i className="bi bi-trash"></i></button>}
                       </div>
                       <div className="grid grid-cols-2 gap-2">
                           {idx === 0 ? <Input label={t('params.inicio')} value={stim.startTime} onChange={(e) => updateStimulus(stim.id, 'startTime', e.target.value)} type="number" /> : <Input label={t('params.intervalo')} value={stim.interval} onChange={(e) => updateStimulus(stim.id, 'interval', e.target.value)} type="number" />}
                           <Input label={t('params.duracao')} value={stim.duration} onChange={(e) => updateStimulus(stim.id, 'duration', e.target.value)} type="number" />
                           <Input label={t('params.amplitude')} value={stim.amplitude} onChange={(e) => updateStimulus(stim.id, 'amplitude', e.target.value)} type="number" />
                           <div className="col-span-2">
                               <label className="text-xs font-medium text-slate-500">{t('common.shape')}</label>
                               <select value={stim.shape} onChange={(e) => updateStimulus(stim.id, 'shape', e.target.value)} className="w-full text-sm p-1 border rounded">
                                   <option value="rectangle">{t('common.rectangle')}</option>
                                   <option value="circle">{t('common.circle')}</option>
                               </select>
                           </div>
                           {stim.shape === 'rectangle' ? (
                               <>
                                <Input label="X1" value={stim.rectParams.x1} onChange={(e) => updateStimulusNested(stim.id, 'rectParams', 'x1', e.target.value)} type="number" />
                                <Input label="Y1" value={stim.rectParams.y1} onChange={(e) => updateStimulusNested(stim.id, 'rectParams', 'y1', e.target.value)} type="number" />
                                <Input label="X2" value={stim.rectParams.x2} onChange={(e) => updateStimulusNested(stim.id, 'rectParams', 'x2', e.target.value)} type="number" />
                                <Input label="Y2" value={stim.rectParams.y2} onChange={(e) => updateStimulusNested(stim.id, 'rectParams', 'y2', e.target.value)} type="number" />
                               </>
                           ) : (
                               <>
                                <Input label="CX" value={stim.circleParams.cx} onChange={(e) => updateStimulusNested(stim.id, 'circleParams', 'cx', e.target.value)} type="number" />
                                <Input label="CY" value={stim.circleParams.cy} onChange={(e) => updateStimulusNested(stim.id, 'circleParams', 'cy', e.target.value)} type="number" />
                                <Input label={t('params.radius')} value={stim.circleParams.radius} onChange={(e) => updateStimulusNested(stim.id, 'circleParams', 'radius', e.target.value)} type="number" />
                               </>
                           )}
                       </div>
                   </div>
               ))}
               <Button onClick={addStimulus} className="w-full text-sm py-1 bg-slate-200 text-slate-700 hover:bg-slate-300"> + {t('common.add_stimulus')} </Button>
            </SettingsSection>

            <SettingsSection title={t('common.heterogeneity')}>
                <div className="space-y-4">
                    <div className="flex items-center gap-2">
                        <input type="checkbox" checked={params.fibrosis} onChange={(e) => handleChange(e, 'fibrosis')} id="chk-fib" className="rounded text-emerald-600 cursor-pointer" />
                        <label htmlFor="chk-fib" className="font-medium text-slate-700 cursor-pointer">{t('common.enable_fibrosis')}</label>
                    </div>
                    
                    {params.fibrosis && (
                        <div className="pl-4 border-l-2 border-slate-200 space-y-3">
                            <div>
                                <label className="text-xs font-medium text-slate-500">{t('common.fibrosis_type')}</label>
                                <select value={params.fibrosisType} onChange={(e) => handleChange(e, 'fibrosisType')} className="w-full text-sm border rounded p-1">
                                    <option value="compact">{t('common.compact')}</option>
                                    <option value="diffuse">{t('common.diffuse')}</option>
                                </select>
                            </div>
                            
                            {params.fibrosisType === 'compact' && (
                                <div>
                                    <label className="text-xs font-medium text-slate-500">{t('common.distribution')}</label>
                                    <select value={params.fibrosisDistribution} onChange={(e) => handleChange(e, 'fibrosisDistribution')} className="w-full text-sm border rounded p-1">
                                        <option value="random">{t('common.random')}</option>
                                        <option value="region">{t('common.region_defined')}</option>
                                    </select>
                                </div>
                            )}

                            <Input label={t('params.condutividade')} value={params.fibrosisConductivity} onChange={(e) => handleChange(e, 'fibrosisConductivity')} type="number" />

                            {params.fibrosisType === 'compact' && params.fibrosisDistribution === 'region' && (
                                <div className="space-y-2 pt-2 border-t border-slate-100">
                                    <label className="text-xs font-medium text-slate-500">{t('common.region_shape')}</label>
                                    <select value={params.fibrosisShape} onChange={(e) => handleChange(e, 'fibrosisShape')} className="w-full text-sm border rounded p-1">
                                        <option value="rectangle">{t('common.rectangle')}</option>
                                        <option value="circle">{t('common.circle')}</option>
                                    </select>
                                    
                                    {params.fibrosisShape === 'rectangle' ? (
                                        <div className="grid grid-cols-2 gap-2">
                                            <Input label="X1" value={params.fibrosisRect.x1} onChange={(e) => handleFibrosisNestedChange('fibrosisRect', 'x1', e.target.value)} type="number" className="mb-0" />
                                            <Input label="Y1" value={params.fibrosisRect.y1} onChange={(e) => handleFibrosisNestedChange('fibrosisRect', 'y1', e.target.value)} type="number" className="mb-0" />
                                            <Input label="X2" value={params.fibrosisRect.x2} onChange={(e) => handleFibrosisNestedChange('fibrosisRect', 'x2', e.target.value)} type="number" className="mb-0" />
                                            <Input label="Y2" value={params.fibrosisRect.y2} onChange={(e) => handleFibrosisNestedChange('fibrosisRect', 'y2', e.target.value)} type="number" className="mb-0" />
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-2 gap-2">
                                            <Input label="CX" value={params.fibrosisCircle.cx} onChange={(e) => handleFibrosisNestedChange('fibrosisCircle', 'cx', e.target.value)} type="number" className="mb-0" />
                                            <Input label="CY" value={params.fibrosisCircle.cy} onChange={(e) => handleFibrosisNestedChange('fibrosisCircle', 'cy', e.target.value)} type="number" className="mb-0" />
                                            <Input label={t('params.radius')} value={params.fibrosisCircle.radius} onChange={(e) => handleFibrosisNestedChange('fibrosisCircle', 'radius', e.target.value)} type="number" className="mb-0 col-span-2" />
                                        </div>
                                    )}
                                    <Input label={t('params.zona_borda')} value={params.fibrosisBorderZone} onChange={(e) => handleChange(e, 'fibrosisBorderZone')} type="number" />
                                </div>
                            )}

                            {params.fibrosisType === 'diffuse' && (
                                <div className="space-y-2 pt-2 border-t border-slate-100">
                                    <p className="text-xs text-slate-500 font-bold">{t('common.fibrosis_area')}</p>
                                    <div className="grid grid-cols-2 gap-2">
                                        <Input label="X1" value={params.fibrosisRegion.x1} onChange={(e) => handleFibrosisNestedChange('fibrosisRegion', 'x1', e.target.value)} type="number" className="mb-0" />
                                        <Input label="Y1" value={params.fibrosisRegion.y1} onChange={(e) => handleFibrosisNestedChange('fibrosisRegion', 'y1', e.target.value)} type="number" className="mb-0" />
                                        <Input label="X2" value={params.fibrosisRegion.x2} onChange={(e) => handleFibrosisNestedChange('fibrosisRegion', 'x2', e.target.value)} type="number" className="mb-0" />
                                        <Input label="Y2" value={params.fibrosisRegion.y2} onChange={(e) => handleFibrosisNestedChange('fibrosisRegion', 'y2', e.target.value)} type="number" className="mb-0" />
                                    </div>
                                    <Input label={t('params.densidade')} value={params.fibrosisDensity} onChange={(e) => handleChange(e, 'fibrosisDensity')} type="number" />
                                    <Input label={t('params.semente')} value={params.fibrosisSeed} onChange={(e) => handleChange(e, 'fibrosisSeed')} type="number" />
                                </div>
                            )}

                            {params.fibrosisType === 'compact' && params.fibrosisDistribution === 'random' && (
                                <div className="pt-2 border-t border-slate-100">
                                    <Input label={t('params.densidade')} value={params.fibrosisDensity} onChange={(e) => handleChange(e, 'fibrosisDensity')} type="number" />
                                    <Input label={t('params.semente')} value={params.fibrosisSeed} onChange={(e) => handleChange(e, 'fibrosisSeed')} type="number" />
                                </div>
                            )}
                        </div>
                    )}

                    <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                        <input type="checkbox" checked={params.transmurality} onChange={(e) => handleChange(e, 'transmurality')} id="chk-trans" className="rounded text-emerald-600 cursor-pointer" />
                        <label htmlFor="chk-trans" className="font-medium text-slate-700 cursor-pointer">{t('common.enable_transmurality')}</label>
                    </div>
                    {params.transmurality && (
                        <div className="pl-4 border-l-2 border-slate-200 space-y-2">
                            <Input label={t('params.mid_start')} value={params.mid_start} onChange={(e) => handleChange(e, 'mid_start')} type="number" />
                            <Input label={t('params.epi_start')} value={params.epi_start} onChange={(e) => handleChange(e, 'epi_start')} type="number" />
                            {selectedModel === 'ms' && (
                                <>
                                    <Input label={t('params.tau_endo')} value={params.endo_tau} onChange={(e) => handleChange(e, 'endo_tau')} type="number" />
                                    <Input label={t('params.tau_mid')} value={params.mid_tau} onChange={(e) => handleChange(e, 'mid_tau')} type="number" />
                                    <Input label={t('params.tau_epi')} value={params.epi_tau} onChange={(e) => handleChange(e, 'epi_tau')} type="number" />
                                </>
                            )}
                        </div>
                    )}
                </div>
            </SettingsSection>
          </div>
        </aside>

        <main className="flex-1 bg-slate-100 relative flex flex-col min-h-0">
          <div className="flex-1 flex items-center justify-center p-4 overflow-hidden relative">
            <div className="relative shadow-2xl rounded-lg overflow-hidden bg-black border-4 border-white aspect-square max-h-full">
               <HeatmapChart 
                 data={currentChartData} 
                 nCols={N_dimension} 
                 maxValue={selectedModel === 'minimal' ? 2.0 : 1.0} 
                 onPointClick={(point) => { setSelectedPoint(point); setIsChartModalOpen(true); }}
                 fibrosisMap={currentFibrosisMap} 
                 fibrosisConductivity={params.fibrosisConductivity}
               />
               {!simulationResult && !calculating && (
                 <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/80 text-white pointer-events-none">
                     <i className="bi bi-play-circle text-5xl mb-2 opacity-80"></i>
                     <p>{t('common.ready')}</p>
                 </div>
               )}
            </div>
          </div>

          {calculating && (
             <div className="absolute bottom-24 left-1/2 -translate-x-1/2 w-64 md:w-96 bg-white p-3 rounded-lg shadow-xl z-30">
                 <div className="flex justify-between text-xs font-bold text-slate-600 mb-1">
                     <span>{t('common.simulating')}</span><span>{progress}%</span>
                 </div>
                 <div className="w-full bg-slate-200 rounded-full h-2 mb-1 overflow-hidden">
                     <div className="bg-emerald-500 h-2 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
                 </div>
                 <div className="text-center text-[10px] text-slate-400">
                     {remainingTime ? `~${Math.ceil(remainingTime/1000)}s ${t('common.remaining')}` : t('common.calculating')}
                 </div>
             </div>
          )}

          <div className="bg-white border-t border-slate-200 p-4 shadow-lg z-20">
            <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    {!calculating ? (
                        <button onClick={handleStart} className={`rounded-full px-6 py-2 font-bold text-white shadow-md transition-transform active:scale-95 flex items-center gap-2 ${simulationResult ? 'bg-slate-500 hover:bg-slate-600 text-sm' : 'bg-emerald-600 hover:bg-emerald-700 text-base'}`}>
                            {simulationResult ? <><i className="bi bi-arrow-repeat"></i> {t('common.resimulate')}</> : <><i className="bi bi-cpu"></i> {t('common.simulate')}</>}
                        </button>
                    ) : (
                        <button onClick={handleStop} className="bg-red-500 hover:bg-red-600 text-white rounded-full px-6 py-2 font-bold shadow-md transition-transform active:scale-95 flex items-center gap-2">
                            <i className="bi bi-stop-fill"></i> {t('common.stop')}
                        </button>
                    )}
                    {simulationResult && (
                        <>
                            <div className="h-8 w-px bg-slate-300 mx-2"></div>
                            <button onClick={() => setIsPlaying(!isPlaying)} className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-full w-12 h-12 flex items-center justify-center shadow-md transition-transform active:scale-95">
                                <i className={`bi ${isPlaying ? 'bi-pause-fill' : 'bi-play-fill'} text-2xl ml-${isPlaying ? '0' : '1'}`}></i>
                            </button>
                        </>
                    )}
                </div>

                {simulationResult && (
                    <div className="flex-1 w-full flex items-center gap-3">
                        <span className="text-xs font-mono text-slate-500 w-12 text-right">{(simulationResult.times[currentFrame] || 0).toFixed(0)}ms</span>
                        <input type="range" min="0" max={simulationResult.totalFrames - 1} value={currentFrame} onChange={(e) => { setIsPlaying(false); setCurrentFrame(parseInt(e.target.value)); }} className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600" />
                        <span className="text-xs font-mono text-slate-500 w-12">{(simulationResult.times[simulationResult.totalFrames-1] || 0).toFixed(0)}ms</span>
                        
                        <div className="flex items-center gap-2 ml-4 border-l border-slate-200 pl-4" title={t('common.speed')}>
                            <i className="bi bi-speedometer2 text-slate-400"></i>
                            <input type="range" min="1" max="100" value={playbackSpeed} onChange={(e) => setPlaybackSpeed(parseInt(e.target.value))} className="w-20 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-slate-500" />
                        </div>
                    </div>
                )}
                
                <Button onClick={() => setIsInfoModalOpen(true)} className="!bg-slate-100 !text-slate-600 hover:!bg-slate-200 !p-2 !rounded-lg" title={t('common.more_info')}>
                    <i className="bi bi-info-circle text-lg"></i>
                </Button>
            </div>
          </div>
        </main>
      </div>

      <Modal isOpen={isChartModalOpen} onClose={() => setIsChartModalOpen(false)}>
         <h2 className="text-lg font-bold mb-2">{t('common.action_potential')}</h2>
         <Chart data={getTimeseriesForPoint()} />
      </Modal>

      {/* Modal para Informações */}
      <Modal isOpen={isInfoModalOpen} onClose={() => setIsInfoModalOpen(false)}>
        <div className="info-modal-content text-slate-800 space-y-6 max-h-[80vh] overflow-y-auto pr-2 custom-scrollbar">
            
            <section>
                <h2 className="text-2xl font-bold text-emerald-800 mb-2">{t('home.models.model_2d.title')}</h2>
                <p className="text-slate-600 leading-relaxed">
                    {t('modals.model_2d.desc')}
                </p>
            </section>

            <section>
                <h3 className="text-lg font-bold text-slate-700 border-b border-slate-200 pb-1 mb-3">
                    {t('modals.math_model')} ({selectedModel === 'ms' ? 'Mitchell-Schaeffer' : 'Minimal Model'})
                </h3>
                <p className="mb-2 text-sm text-slate-600">
                    {t('modals.model_2d.math_intro')}
                </p>
                
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 font-mono text-sm text-center my-3 overflow-x-auto">
                    {t('modals.model_2d.eq_diffusion')}
                </div>
                <p className="text-xs text-slate-500 italic mb-4">{t('modals.model_2d.eq_diffusion_desc')}</p>
                
                {selectedModel === 'ms' ? (
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 font-mono text-sm space-y-2">
                        <div className="text-center font-bold mb-2">{t('modals.model_2d.ms.title')}</div>
                        <p>{t('modals.model_2d.ms.eq_v')}</p>
                        <p>{t('modals.model_2d.ms.eq_h_open')}</p>
                        <p>{t('modals.model_2d.ms.eq_h_close')}</p>
                    </div>
                ) : (
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 font-mono text-sm space-y-2">
                        <div className="text-center font-bold mb-2">{t('modals.model_2d.minimal.title')}</div>
                        <p>{t('modals.model_2d.minimal.eq_u')}</p>
                        <hr className="border-slate-200 my-2"/>
                        <p><strong>{t('modals.model_2d.minimal.vars')}</strong></p>
                        <p><strong>{t('modals.model_2d.minimal.currents')}</strong></p>
                    </div>
                )}
            </section>

            <section>
                <h3 className="text-lg font-bold text-slate-700 border-b border-slate-200 pb-1 mb-3">{t('modals.numerical_method')}</h3>
                <ul className="list-disc pl-5 text-sm space-y-2 text-slate-600">
                    {safeList('modals.model_2d.numerical_details').map((item, i) => (
                        <li key={i}>{item}</li>
                    ))}
                </ul>
            </section>

            <section>
                <h3 className="text-lg font-bold text-slate-700 border-b border-slate-200 pb-1 mb-3">{t('modals.advanced_features')}</h3>
                <div className="space-y-3 text-sm text-slate-600">
                    <p><strong>{t('modals.model_2d.features.fibrosis_title')}:</strong> {t('modals.model_2d.features.fibrosis_desc')}</p>
                    <p><strong>{t('modals.model_2d.features.transmurality_title')}:</strong> {t('modals.model_2d.features.transmurality_desc')}</p>
                </div>
            </section>

            <section>
                <h3 className="text-lg font-bold text-slate-700 border-b border-slate-200 pb-1 mb-3">{t('modals.param_meaning')}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 text-xs text-slate-600">
                    <div className="col-span-2 font-bold text-slate-800 border-b border-slate-100 pb-1 mb-1">{t('modals.model_2d.glossary.general')}</div>
                    <div>{t('modals.model_2d.glossary.L_N')}</div>
                    <div>{t('modals.model_2d.glossary.dt')}</div>
                    <div>{t('modals.model_2d.glossary.sigma')}</div>
                    <div>{t('modals.model_2d.glossary.angle')}</div>
                    
                    {selectedModel === 'ms' ? (
                        <>
                            <div className="col-span-2 font-bold text-slate-800 border-b border-slate-100 pb-1 mb-1 mt-2">{t('modals.model_2d.glossary.ms_params')}</div>
                            <div>{t('modals.model_2d.glossary.tau_in_out')}</div>
                            <div>{t('modals.model_2d.glossary.tau_gates')}</div>
                        </>
                    ) : (
                        <>
                            <div className="col-span-2 font-bold text-slate-800 border-b border-slate-100 pb-1 mb-1 mt-2">{t('modals.model_2d.glossary.minimal_params')}</div>
                            <div>{t('modals.model_2d.glossary.u_levels')}</div>
                            <div>{t('modals.model_2d.glossary.tau_constants')}</div>
                        </>
                    )}
                </div>
            </section>

            <section>
                <h3 className="text-lg font-bold text-slate-700 border-b border-slate-200 pb-1 mb-3">{t('modals.how_to_use')}</h3>
                <ol className="list-decimal pl-5 text-slate-700 space-y-1 text-sm">
                    {safeList('modals.model_2d.steps').map((step, i) => (
                        <li key={i}>{step}</li>
                    ))}
                </ol>
            </section>

        </div>
      </Modal>
    </div>
  );
};

export default Model2DPage;