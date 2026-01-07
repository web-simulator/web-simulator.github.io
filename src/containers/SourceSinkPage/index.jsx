import { useState, useEffect, useCallback, useMemo } from 'react';
import HeatmapChart from '../../components/HeatmapChart';
import Colorbar from '../../components/Colorbar';
import Input from '../../components/Input';
import Button from '../../components/Button';
import Modal from '../../components/Modal';
import Chart from '../../components/Chart';
import SimulationWorker from '../../simulation_source_sink.worker.js?worker';
import { useTranslation } from 'react-i18next';
import './styles.css';

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

// Parametros minimal model
const DEFAULT_MINIMAL_PARAMS = {
  endo: { u_o: 0.0, u_u: 1.56, theta_v: 0.3, theta_w: 0.13, theta_vminus: 0.2, theta_o: 0.006, tau_v1minus: 75.0, tau_v2minus: 10.0, tau_vplus: 1.4506, tau_w1minus: 6.0, tau_w2minus: 140.0, k_wminus: 200.0, u_wminus: 0.016, tau_wplus: 280.0, tau_fi: 0.15, tau_o1: 470.0, tau_o2: 6.0, tau_so1: 40.0, tau_so2: 1.2, k_so: 2.0, u_so: 0.65, tau_s1: 2.7342, tau_s2: 2.0, k_s: 2.0994, u_s: 0.9087, tau_si: 2.9013, tau_winf: 0.0273, w_infstar: 0.78 },
  myo: { u_o: 0.0, u_u: 1.61, theta_v: 0.3, theta_w: 0.13, theta_vminus: 0.1, theta_o: 0.005, tau_v1minus: 80.0, tau_v2minus: 1.4506, tau_vplus: 1.4506, tau_w1minus: 70.0, tau_w2minus: 8.0, k_wminus: 200.0, u_wminus: 0.016, tau_wplus: 280.0, tau_fi: 0.117, tau_o1: 410.0, tau_o2: 7.0, tau_so1: 91.0, tau_so2: 0.8, k_so: 2.1, u_so: 0.6, tau_s1: 2.7342, tau_s2: 4.0, k_s: 2.0994, u_s: 0.9087, tau_si: 3.3849, tau_winf: 0.01, w_infstar: 0.5 },
  epi: { u_o: 0.0, u_u: 1.55, theta_v: 0.3, theta_w: 0.13, theta_vminus: 0.006, theta_o: 0.006, tau_v1minus: 60.0, tau_v2minus: 1150.0, tau_vplus: 1.4506, tau_w1minus: 60.0, tau_w2minus: 15.0, k_wminus: 65.0, u_wminus: 0.03, tau_wplus: 200.0, tau_fi: 0.165, tau_o1: 400.0, tau_o2: 6.0, tau_so1: 30.0181, tau_so2: 0.9957, k_so: 2.0458, u_so: 0.65, tau_s1: 2.7342, tau_s2: 16.0, k_s: 2.0994, u_s: 0.9087, tau_si: 1.8875, tau_winf: 0.07, w_infstar: 0.94 }
};

const SourceSinkPage = ({ onBack }) => {
  const { t } = useTranslation();

  const [selectedModel, setSelectedModel] = useState('minimal'); // 'ms' ou 'minimal'
  const [minimalCustomParams, setMinimalCustomParams] = useState(DEFAULT_MINIMAL_PARAMS);

  const [simulationResult, setSimulationResult] = useState(null);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [worker, setWorker] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [simulationSpeed, setSimulationSpeed] = useState(50);
  const [progress, setProgress] = useState(0);
  const [remainingTime, setRemainingTime] = useState(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [selectedPoint, setSelectedPoint] = useState(null);

  // Parâmetros do modelo e geometria
  const [params, setParams] = useState({
    sigma_l: 0.002,
    sigma_t: 0.002,
    angle: 0,
    dt: 0.05,
    totalTime: 600,
    downsamplingFactor: 20,
    // Parametros ms
    Tau_in: 0.3,
    Tau_out: 6.0,
    Tau_open: 120.0,
    Tau_close: 80.0,
    gate: 0.13,

    cellType: 'epi',
    L: 10,
    dx: 0.05,
    // Parâmetros do Obstáculo
    obstacleCx: 5.0,
    obstacleCy: 5.0,
    obstacleRadius: 4.0,
    // Parâmetros da Fenda
    slitWidthStart: 1.0,
    slitWidthEnd: 0.25,
    // Parâmetros de Fibrose
    fibrosis: true,
    fibrosisType: 'diffuse',
    fibrosisDistribution: 'random',
    fibrosisDensity: 4.5,
    fibrosisSeed: 12345,
    fibrosisConductivity: 0.0,
    fibrosisShape: 'rectangle',
    fibrosisBorderZone: 0.0,
    fibrosisRect: { x1: 4.0, y1: 1.0, x2: 6.0, y2: 4.0 },
    fibrosisCircle: { cx: 2.0, cy: 2.0, radius: 0.5 },
    fibrosisRegion: { x1: 4.0, y1: 1.0, x2: 6.0, y2: 4.0 },
  });

  // Parâmetros do Estímulo
  const [stimulusParams, setStimulusParams] = useState({
    cx: 5.0,
    cy: 0.5,
    radius: 0.3,
    startTime: 10,
    duration: 3,
    amplitude: 1.0,
    interval: 0
  });

  // Configuração do Worker
  useEffect(() => {
    const simulationWorker = new SimulationWorker();
    setWorker(simulationWorker);

    simulationWorker.onmessage = (e) => {
      const { type, value, remaining, frames, times, fibrosis, N, totalFrames } = e.data;

      if (type === 'progress') {
        setProgress(value);
        if (remaining !== undefined) setRemainingTime(remaining);
      } else if (type === 'result') {
        setSimulationResult({ frames, times, fibrosis, N, totalFrames });
        setCurrentFrame(0);
        setLoading(false);
        setIsPlaying(true);
        setProgress(0);
        setRemainingTime(null);
      }
    };
    return () => simulationWorker.terminate();
  }, [selectedModel]);

  // Loop de Animação
  useEffect(() => {
    let animationFrameId;
    let lastTime = 0;
    const interval = Math.max(0, (100 - simulationSpeed) * 2);

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

    if (isPlaying && simulationResult) {
      animationFrameId = requestAnimationFrame(animate);
    }

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [isPlaying, simulationResult, simulationSpeed]);

  // Handlers de Mudança
  const handleParamChange = useCallback((e, name) => {
    const target = e.target;
    let value;

    if (target.type === 'checkbox') {
      value = target.checked;
    } else if (target.type === 'number' || target.type === 'range') {
      value = parseFloat(target.value);
    } else {
      value = target.value;
    }

    setParams((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleFibrosisNestedChange = (shapeType, key, value) => {
    setParams(prev => ({
      ...prev,
      [shapeType]: { ...prev[shapeType], [key]: parseFloat(value) }
    }));
  };

  const handleMinimalCustomChange = (param, value) => {
    const activeType = params.cellType;
    setMinimalCustomParams(prev => ({
      ...prev,
      [activeType]: { ...prev[activeType], [param]: parseFloat(value) }
    }));
  };

  const handleStimulusChange = useCallback((e, name) => {
    const value = parseFloat(e.target.value);
    setStimulusParams((prev) => ({ ...prev, [name]: value }));
  }, []);

  // Handler de Simulação
  const handleSimularClick = useCallback(() => {
    if (worker) {
      setLoading(true);
      setSimulationResult(null);
      setIsPlaying(false);
      setProgress(0);
      setRemainingTime(null);

      const stimulusObj = {
        startTime: stimulusParams.startTime,
        interval: stimulusParams.interval,
        duration: stimulusParams.duration,
        amplitude: stimulusParams.amplitude,
        shape: 'circle',
        circleParams: {
          cx: stimulusParams.cx,
          cy: stimulusParams.cy,
          radius: stimulusParams.radius
        }
      };

      const obstacleObj = {
        cx: params.obstacleCx,
        cy: params.obstacleCy,
        radius: params.obstacleRadius
      };

      const slitObj = {
        widthStart: params.slitWidthStart,
        widthEnd: params.slitWidthEnd
      };

      const safeMinimalParams = {};
      if (selectedModel === 'minimal') {
        Object.keys(minimalCustomParams).forEach(type => {
          safeMinimalParams[type] = {};
          Object.keys(minimalCustomParams[type]).forEach(k => {
            safeMinimalParams[type][k] = parseFloat(minimalCustomParams[type][k]);
          });
        });
      }

      const fibrosisPayload = {
        enabled: params.fibrosis,
        type: params.fibrosisType,
        distribution: params.fibrosisDistribution,
        shape: params.fibrosisShape,
        conductivity: params.fibrosisConductivity,
        density: params.fibrosisDensity / 100.0,
        seed: params.fibrosisSeed,
        borderZone: params.fibrosisBorderZone,
        rectParams: params.fibrosisRect,
        circleParams: params.fibrosisCircle,
        regionParams: params.fibrosisRegion
      };

      worker.postMessage({
        modelType: selectedModel,
        ...params,
        stimuli: [stimulusObj],
        obstacleParams: obstacleObj,
        slitParams: slitObj,
        fiber_angle: params.angle,
        fibrosisParams: fibrosisPayload,
        minimalCellParams: safeMinimalParams
      });
    }
  }, [worker, params, stimulusParams, selectedModel, minimalCustomParams]);

  // Handler de Parada
  const handleStop = () => {
    if (worker) worker.terminate();
    const newWorker = new SimulationWorker();
    newWorker.onmessage = (e) => {
      const { type, value, remaining, frames, times, fibrosis, N, totalFrames } = e.data;
      if (type === 'progress') {
        setProgress(value);
        if (remaining !== undefined) setRemainingTime(remaining);
      } else if (type === 'result') {
        setSimulationResult({ frames, times, fibrosis, N, totalFrames });
        setCurrentFrame(0);
        setLoading(false);
        setIsPlaying(true);
      }
    };
    setWorker(newWorker);
    setLoading(false);
    setProgress(0);
  };

  const handleSliderChange = (e) => {
    setIsPlaying(false);
    setCurrentFrame(parseInt(e.target.value, 10));
  };

  // Abre o modal com o gráfico do ponto clicado
  const handlePointClick = useCallback((point) => {
    setSelectedPoint(point);
    setIsModalOpen(true);
  }, []);

  let currentChartData = null;
  let currentGeometryMap = null;
  let N_dimension = simulationResult ? simulationResult.N : Math.round((params.L / params.dx));
  const heatmapMaxValue = selectedModel === 'minimal' ? 2.0 : 1.0;

  if (simulationResult) {
    const { frames, fibrosis, N } = simulationResult;
    N_dimension = N;
    const start = currentFrame * N * N;
    const end = start + N * N;
    currentChartData = frames.subarray(start, end);
    currentGeometryMap = fibrosis;
  }

  const timeseriesData = useMemo(() => {
    if (!selectedPoint || !simulationResult) return [];

    const { frames, times, N, totalFrames } = simulationResult;
    const { i, j } = selectedPoint;
    const idx = i * N + j;

    const timeseries = [];
    for (let f = 0; f < totalFrames; f++) {
      const val = frames[f * N * N + idx];
      const t = times[f];
      timeseries.push({ tempo: parseFloat(t.toFixed(2)), v: val });
    }
    return timeseries;
  }, [selectedPoint, simulationResult]);

  const renderInfoModalContent = () => (
    <div className="info-modal-content text-slate-800 space-y-6 max-h-[80vh] overflow-y-auto pr-2 custom-scrollbar">
      <section>
        <h2 className="text-2xl font-bold text-emerald-800 mb-2">{t('home.models.source_sink.title')}</h2>
        <p className="text-slate-600 leading-relaxed">{t('modals.source_sink.desc')}</p>
      </section>

      <section>
        <h3 className="text-lg font-bold text-slate-700 border-b border-slate-200 pb-1 mb-3">{t('modals.math_model')}</h3>
        <p className="text-slate-600 mb-2">{t('modals.source_sink.geometry_desc')}</p>
        <p className="text-sm text-slate-500 mb-2">
          {selectedModel === 'ms'
            ? "Modelo: Mitchell-Schaeffer"
            : "Modelo: Minimal Model "}
        </p>
      </section>

      <section>
        <h3 className="text-lg font-bold text-slate-700 border-b border-slate-200 pb-1 mb-3">{t('modals.param_meaning')}</h3>
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-slate-600">
          <li><strong className="text-slate-700">{t('params.slitWidthStart')}:</strong> Abertura da fenda no topo.</li>
          <li><strong className="text-slate-700">{t('params.slitWidthEnd')}:</strong> Abertura da fenda na base.</li>
          <li><strong className="text-slate-700">{t('params.obstacleRadius')}:</strong> Raio do obstáculo semicircular.</li>
        </ul>
      </section>
    </div>
  );

  const chartModalContent = useMemo(() => (
    <>
      <h2 className="text-lg font-bold text-slate-700 mb-4">
        Potencial em (x: {selectedPoint ? (selectedPoint.j * params.dx).toFixed(2) : 0}, y: {selectedPoint ? (selectedPoint.i * params.dx).toFixed(2) : 0})
      </h2>
      <Chart data={timeseriesData} />
    </>
  ), [selectedPoint, params.dx, timeseriesData]);

  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-auto lg:overflow-hidden">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 h-16 flex-none flex items-center justify-between px-6 shadow-sm z-20 sticky top-0 lg:relative">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-full transition-colors">
            <i className="bi bi-arrow-left text-xl"></i>
          </button>
          <h1 className="text-xl font-bold text-slate-800 hidden sm:block">{t('home.models.source_sink.title')}</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-500 hidden sm:block">{t('common.select_model')}:</span>
          <select
            value={selectedModel}
            onChange={(e) => { setSimulationResult(null); setSelectedModel(e.target.value); }}
            className="bg-slate-100 border-none text-sm font-medium text-slate-700 py-2 px-4 rounded-lg cursor-pointer focus:ring-2 focus:ring-emerald-500"
          >
            <option value="ms">{t('common.ms_model')}</option>
            <option value="minimal">{t('common.minimal_model')}</option>
          </select>
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row lg:overflow-hidden">
        {/* Sidebar */}
        <aside className="w-full lg:w-96 bg-white border-r border-slate-200 lg:overflow-y-auto custom-scrollbar flex-none shadow-xl z-10">
          <div className="p-6 pb-24 lg:pb-6">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">{t('common.configuration')}</p>

            <SettingsSection title={t('common.geometry')} defaultOpen={true}>
              <div className="grid grid-cols-2 gap-3">
                <Input label={t('params.obstacleCx')} value={params.obstacleCx} onChange={(e) => handleParamChange(e, 'obstacleCx')} type="number" className="mb-0" />
                <Input label={t('params.obstacleCy')} value={params.obstacleCy} onChange={(e) => handleParamChange(e, 'obstacleCy')} type="number" className="mb-0" />
                <Input label={t('params.obstacleRadius')} value={params.obstacleRadius} onChange={(e) => handleParamChange(e, 'obstacleRadius')} type="number" className="col-span-2 mb-0" />
                <div className="col-span-2 border-t border-slate-100 my-2"></div>
                <Input label={t('params.slitWidthStart')} value={params.slitWidthStart} onChange={(e) => handleParamChange(e, 'slitWidthStart')} type="number" className="mb-0" />
                <Input label={t('params.slitWidthEnd')} value={params.slitWidthEnd} onChange={(e) => handleParamChange(e, 'slitWidthEnd')} type="number" className="mb-0" />
                <Input label={t('params.L')} value={params.L} onChange={(e) => handleParamChange(e, 'L')} type="number" className="mb-0" />
                <Input label={t('params.dx')} value={params.dx} onChange={(e) => handleParamChange(e, 'dx')} type="number" className="mb-0" />
              </div>
            </SettingsSection>

            <SettingsSection title={t('common.stimulus')} defaultOpen={true}>
              <div className="grid grid-cols-2 gap-3">
                <Input label={t('params.cx')} value={stimulusParams.cx} onChange={(e) => handleStimulusChange(e, 'cx')} type="number" className="mb-0" />
                <Input label={t('params.cy')} value={stimulusParams.cy} onChange={(e) => handleStimulusChange(e, 'cy')} type="number" className="mb-0" />
                <Input label={t('params.radius')} value={stimulusParams.radius} onChange={(e) => handleStimulusChange(e, 'radius')} type="number" className="col-span-2 mb-0" />
                <Input label={t('params.startTime')} value={stimulusParams.startTime} onChange={(e) => handleStimulusChange(e, 'startTime')} type="number" className="mb-0" />
                <Input label={t('params.duracao')} value={stimulusParams.duration} onChange={(e) => handleStimulusChange(e, 'duration')} type="number" className="mb-0" />
              </div>
            </SettingsSection>

            <SettingsSection title={t('common.heterogeneity')}>
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={params.fibrosis} onChange={(e) => handleParamChange(e, 'fibrosis')} id="chk-fib" className="rounded text-emerald-600 cursor-pointer" />
                  <label htmlFor="chk-fib" className="font-medium text-slate-700 cursor-pointer">{t('common.enable_fibrosis')}</label>
                </div>

                {params.fibrosis && (
                  <div className="pl-4 border-l-2 border-slate-200 space-y-3">
                    <div>
                      <label className="text-xs font-medium text-slate-500">{t('common.fibrosis_type')}</label>
                      <select value={params.fibrosisType} onChange={(e) => handleParamChange(e, 'fibrosisType')} className="w-full text-sm border rounded p-1">
                        <option value="compact">{t('common.compact')}</option>
                        <option value="diffuse">{t('common.diffuse')}</option>
                      </select>
                    </div>

                    {params.fibrosisType === 'compact' && (
                      <div>
                        <label className="text-xs font-medium text-slate-500">{t('common.distribution')}</label>
                        <select value={params.fibrosisDistribution} onChange={(e) => handleParamChange(e, 'fibrosisDistribution')} className="w-full text-sm border rounded p-1">
                          <option value="random">{t('common.random')}</option>
                          <option value="region">{t('common.region_defined')}</option>
                        </select>
                      </div>
                    )}

                    <Input label={t('params.condutividade')} value={params.fibrosisConductivity} onChange={(e) => handleParamChange(e, 'fibrosisConductivity')} type="number" />

                    {params.fibrosisType === 'compact' && params.fibrosisDistribution === 'region' && (
                      <div className="space-y-2 pt-2 border-t border-slate-100">
                        <label className="text-xs font-medium text-slate-500">{t('common.region_shape')}</label>
                        <select value={params.fibrosisShape} onChange={(e) => handleParamChange(e, 'fibrosisShape')} className="w-full text-sm border rounded p-1">
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
                        <Input label={t('params.zona_borda')} value={params.fibrosisBorderZone} onChange={(e) => handleParamChange(e, 'fibrosisBorderZone')} type="number" />
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
                        <Input label={t('params.densidade')} value={params.fibrosisDensity} onChange={(e) => handleParamChange(e, 'fibrosisDensity')} type="number" />
                        <Input label={t('params.semente')} value={params.fibrosisSeed} onChange={(e) => handleParamChange(e, 'fibrosisSeed')} type="number" />
                      </div>
                    )}

                    {params.fibrosisType === 'compact' && params.fibrosisDistribution === 'random' && (
                      <div className="pt-2 border-t border-slate-100">
                        <Input label={t('params.densidade')} value={params.fibrosisDensity} onChange={(e) => handleParamChange(e, 'fibrosisDensity')} type="number" />
                        <Input label={t('params.semente')} value={params.fibrosisSeed} onChange={(e) => handleParamChange(e, 'fibrosisSeed')} type="number" />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </SettingsSection>

            <SettingsSection title={t('common.tissue_properties')}>
              <div className="grid grid-cols-2 gap-3">
                <Input label={t('params.sigma_l')} value={params.sigma_l} onChange={(e) => handleParamChange(e, 'sigma_l')} type="number" className="mb-0" />
                <Input label={t('params.sigma_t')} value={params.sigma_t} onChange={(e) => handleParamChange(e, 'sigma_t')} type="number" className="mb-0" />
                <Input label={t('params.angle')} value={params.angle} onChange={(e) => handleParamChange(e, 'angle')} type="number" className="col-span-2 mb-0" />

                <div className="col-span-2 border-t border-slate-100 my-2"></div>

                <Input label={t('params.dt')} value={params.dt} onChange={(e) => handleParamChange(e, 'dt')} type="number" className="mb-0" />
                <Input label={t('params.totalTime')} value={params.totalTime} onChange={(e) => handleParamChange(e, 'totalTime')} type="number" className="mb-0" />
                <Input label={t('common.save_stride')} value={params.downsamplingFactor} onChange={(e) => handleParamChange(e, 'downsamplingFactor')} type="number" className="col-span-2 mb-0" />

                {selectedModel === 'ms' ? (
                  <>
                    <div className="col-span-2 font-bold text-xs text-slate-500 mt-2 border-t border-slate-100 pt-2">Mitchell-Schaeffer</div>
                    <Input label={t('params.Tau_in')} value={params.Tau_in} onChange={(e) => handleParamChange(e, 'Tau_in')} type="number" className="mb-0" />
                    <Input label={t('params.Tau_out')} value={params.Tau_out} onChange={(e) => handleParamChange(e, 'Tau_out')} type="number" className="mb-0" />
                    <Input label={t('params.gate')} value={params.gate} onChange={(e) => handleParamChange(e, 'gate')} type="number" className="mb-0" />
                    <Input label={t('params.Tau_open')} value={params.Tau_open} onChange={(e) => handleParamChange(e, 'Tau_open')} type="number" className="mb-0" />
                    <Input label={t('params.Tau_close')} value={params.Tau_close} onChange={(e) => handleParamChange(e, 'Tau_close')} type="number" className="mb-0" />
                  </>
                ) : (
                  <>
                    <div className="col-span-2 font-bold text-xs text-slate-500 mt-2 border-t border-slate-100 pt-2">Minimal Model</div>
                    <div className="col-span-2 mb-0">
                      <label className="text-sm font-medium text-slate-700">{t('common.cell_type')}</label>
                      <select value={params.cellType} onChange={(e) => handleParamChange(e, 'cellType')} className="w-full mt-1 px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm">
                        <option value="epi">{t('params.epi')}</option>
                        <option value="endo">{t('params.endo')}</option>
                        <option value="myo">{t('params.myo')}</option>
                      </select>
                    </div>

                    <div className="col-span-2 mt-2 pt-2 border-t border-slate-100">
                      <p className="text-xs font-semibold text-slate-500 mb-2">{t('common.custom_params')} ({t(`params.${params.cellType}`)})</p>
                      <div className="grid grid-cols-2 gap-2">
                        {Object.keys(minimalCustomParams[params.cellType]).slice(0, 6).map(key => (
                          <Input key={key} label={t(`params.${key}`) || key} value={minimalCustomParams[params.cellType][key]} onChange={(e) => handleMinimalCustomChange(key, e.target.value)} type="number" className="mb-0" />
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </SettingsSection>
          </div>
        </aside>

        {/* Conteúdo Principal */}
        <main className="flex-1 bg-slate-100 relative flex flex-col min-h-[50vh] lg:min-h-0">
          <div className="flex-1 flex items-center justify-center p-4 relative overflow-hidden">
            <div className="flex items-center justify-center gap-4 w-full h-full">
              <div className="relative shadow-lg rounded-lg overflow-hidden bg-white border border-slate-200 aspect-square w-full h-auto lg:h-full lg:w-auto max-w-full max-h-full">
                <HeatmapChart
                  data={currentChartData}
                  nCols={N_dimension}
                  maxValue={heatmapMaxValue}
                  onPointClick={handlePointClick}
                  fibrosisMap={currentGeometryMap}
                  fibrosisConductivity={params.fibrosis ? params.fibrosisConductivity : 0.0}
                />
                {!simulationResult && !loading && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50/80 text-slate-400 pointer-events-none">
                    <i className="bi bi-activity text-6xl mb-4 opacity-50"></i>
                    <p>{t('common.ready')}</p>
                  </div>
                )}
              </div>
              <div className="hidden sm:block">
                <Colorbar maxValue={heatmapMaxValue} minValue={0} />
              </div>
            </div>
          </div>

          {loading && (
            <div className="absolute bottom-24 left-1/2 -translate-x-1/2 w-64 md:w-96 bg-white p-3 rounded-lg shadow-xl z-30">
              <div className="flex justify-between text-xs font-bold text-slate-600 mb-1">
                <span>{t('common.simulating')}</span><span>{progress}%</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2 mb-1 overflow-hidden">
                <div className="bg-emerald-500 h-2 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
              </div>
              <div className="text-center text-[10px] text-slate-400">
                {remainingTime ? `~${Math.ceil(remainingTime / 1000)}s ${t('common.remaining')}` : t('common.calculating')}
              </div>
            </div>
          )}

          <div className="bg-white border-t border-slate-200 p-4 shadow-lg z-20">
            <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                {!loading ? (
                  <button
                    onClick={handleSimularClick}
                    className={`rounded-full px-6 py-2 font-bold text-white shadow-md transition-transform active:scale-95 flex items-center gap-2 ${simulationResult ? 'bg-slate-500 hover:bg-slate-600 text-sm' : 'bg-emerald-600 hover:bg-emerald-700 text-base'}`}
                  >
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
                    <button
                      onClick={() => setIsPlaying(!isPlaying)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-full w-12 h-12 flex items-center justify-center shadow-md transition-transform active:scale-95"
                      title={isPlaying ? t('common.pause') : t('common.resume')}
                    >
                      <i className={`bi ${isPlaying ? 'bi-pause-fill' : 'bi-play-fill'} text-2xl ml-${isPlaying ? '0' : '1'}`}></i>
                    </button>
                  </>
                )}
              </div>

              {simulationResult && (
                <div className="flex-1 w-full flex items-center gap-3">
                  <span className="text-xs font-mono text-slate-500 w-12 text-right">{(simulationResult.times[currentFrame] || 0).toFixed(0)}ms</span>
                  <input
                    type="range"
                    min="0"
                    max={simulationResult.totalFrames - 1}
                    value={currentFrame}
                    onChange={handleSliderChange}
                    className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                  />
                  <span className="text-xs font-mono text-slate-500 w-12">{(simulationResult.times[simulationResult.totalFrames - 1] || 0).toFixed(0)}ms</span>

                  <div className="flex items-center gap-2 ml-4 border-l border-slate-200 pl-4" title={t('common.speed')}>
                    <i className="bi bi-speedometer2 text-slate-400"></i>
                    <input
                      type="range"
                      min="1"
                      max="100"
                      value={simulationSpeed}
                      onChange={(e) => setSimulationSpeed(parseInt(e.target.value, 10))}
                      className="w-20 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-slate-500"
                    />
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

      {/* Modal do gráfico de ponto */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
        {chartModalContent}
      </Modal>

      {/* Modal de Informações */}
      <Modal isOpen={isInfoModalOpen} onClose={() => setIsInfoModalOpen(false)}>
        {renderInfoModalContent()}
      </Modal>
    </div>
  );
};

export default SourceSinkPage;