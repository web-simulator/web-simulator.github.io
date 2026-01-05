import { useState, useEffect, useCallback } from 'react';
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

const SourceSinkPage = ({ onBack }) => {
  const { t } = useTranslation();
  
  // Estados de Controle da Simulação
  const [simulationResult, setSimulationResult] = useState(null);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [worker, setWorker] = useState(null); 
  const [loading, setLoading] = useState(false); 
  const [isPlaying, setIsPlaying] = useState(false); 
  const [simulationSpeed, setSimulationSpeed] = useState(50);
  const [progress, setProgress] = useState(0);
  const [remainingTime, setRemainingTime] = useState(null);

  // Estados de Interface
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [selectedPoint, setSelectedPoint] = useState(null);

  // Parâmetros do modelo e geometria
  const [params, setParams] = useState({
    sigma_l: 0.002, 
    sigma_t: 0.002, 
    angle: 0,       
    Tau_in: 0.3,
    Tau_out: 6.0,
    Tau_open: 120.0,
    Tau_close: 80.0,
    gate: 0.13,
    L: 5,
    dt: 0.05,
    dx: 0.05,
    totalTime: 600,
    downsamplingFactor: 20,
    // Parâmetros do Obstáculo
    obstacleCx: 2.0,
    obstacleCy: 2.0,
    obstacleRadius: 1.0,
    // Parâmetros da Fenda
    slitWidthStart: 0.8, 
    slitWidthEnd: 0.15   
  });

  // Parâmetros do Estímulo
  const [stimulusParams, setStimulusParams] = useState({
    cx: 2.0, 
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
  }, []);

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
    const value = parseFloat(e.target.value);
    setParams((prev) => ({ ...prev, [name]: value }));
  }, []);

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

      worker.postMessage({
        ...params,
        stimuli: [stimulusObj], 
        obstacleParams: obstacleObj,
        slitParams: slitObj,
        fiber_angle: params.angle, 
        fibrosisParams: { enabled: false }, 
      });
    }
  }, [worker, params, stimulusParams]);

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

  // Dados para Gráficos
  const getTimeseriesForPoint = () => {
    if (!selectedPoint || !simulationResult) return [];
    
    const { frames, times, N, totalFrames } = simulationResult;
    const { i, j } = selectedPoint;
    const idx = i * N + j;
    
    const timeseries = [];
    for(let f = 0; f < totalFrames; f++) {
        const val = frames[f * N * N + idx];
        const t = times[f];
        timeseries.push({ tempo: parseFloat(t.toFixed(2)), v: val });
    }
    return timeseries;
  };

  // Prepara os dados para o Heatmap
  let currentChartData = null;
  let currentGeometryMap = null;
  let N_dimension = simulationResult ? simulationResult.N : Math.round((params.L / params.dx));

  if (simulationResult) {
      const { frames, fibrosis, N } = simulationResult;
      N_dimension = N;
      const start = currentFrame * N * N;
      const end = start + N * N;
      currentChartData = frames.subarray(start, end);
      currentGeometryMap = fibrosis; 
  }

  const timeseriesData = getTimeseriesForPoint(); 

  const renderInfoModalContent = () => (
    <div className="info-modal-content text-slate-800 space-y-6 max-h-[80vh] overflow-y-auto pr-2 custom-scrollbar">
      <section>
          <h2 className="text-2xl font-bold text-emerald-800 mb-2">{t('home.models.source_sink.title')}</h2>
          <p className="text-slate-600 leading-relaxed">{t('modals.source_sink.desc')}</p>
      </section>

      <section>
          <h3 className="text-lg font-bold text-slate-700 border-b border-slate-200 pb-1 mb-3">{t('modals.math_model')}</h3>
          <p className="text-slate-600 mb-2">{t('modals.source_sink.geometry_desc')}</p>
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 font-mono text-sm overflow-x-auto">
             <code>{t('modals.source_sink.eq')}</code>
          </div>
      </section>

      <section>
          <h3 className="text-lg font-bold text-slate-700 border-b border-slate-200 pb-1 mb-3">{t('modals.numerical_method')}</h3>
          <p className="text-slate-600 text-sm">{t('modals.ms2d.method')}</p>
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

            <SettingsSection title={t('common.tissue_properties')}>
                <div className="grid grid-cols-2 gap-3">
                    <Input label={t('params.Tau_in')} value={params.Tau_in} onChange={(e) => handleParamChange(e, 'Tau_in')} type="number" className="mb-0" />
                    <Input label={t('params.Tau_out')} value={params.Tau_out} onChange={(e) => handleParamChange(e, 'Tau_out')} type="number" className="mb-0" />
                    <Input label={t('params.gate')} value={params.gate} onChange={(e) => handleParamChange(e, 'gate')} type="number" className="mb-0" />
                    <Input label={t('params.sigma_l')} value={params.sigma_l} onChange={(e) => handleParamChange(e, 'sigma_l')} type="number" className="mb-0" />
                    <Input label={t('params.dt')} value={params.dt} onChange={(e) => handleParamChange(e, 'dt')} type="number" className="mb-0" />
                    <Input label={t('params.totalTime')} value={params.totalTime} onChange={(e) => handleParamChange(e, 'totalTime')} type="number" className="mb-0" />
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
                        maxValue={1.0} 
                        onPointClick={handlePointClick}
                        fibrosisMap={currentGeometryMap} 
                        fibrosisConductivity={0.0} 
                    />
                    {!simulationResult && !loading && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50/80 text-slate-400 pointer-events-none">
                            <i className="bi bi-activity text-6xl mb-4 opacity-50"></i>
                            <p>{t('common.ready')}</p>
                        </div>
                    )}
                </div>
                <div className="hidden sm:block">
                    <Colorbar maxValue={1.0} minValue={0} />
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
                     {remainingTime ? `~${Math.ceil(remainingTime/1000)}s ${t('common.remaining')}` : t('common.calculating')}
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
                        <span className="text-xs font-mono text-slate-500 w-12">{(simulationResult.times[simulationResult.totalFrames-1] || 0).toFixed(0)}ms</span>
                        
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
        <h2 className="text-lg font-bold text-slate-700 mb-4">
          Potencial em (x: {selectedPoint ? (selectedPoint.j * params.dx).toFixed(2) : 0}, y: {selectedPoint ? (selectedPoint.i * params.dx).toFixed(2) : 0})
        </h2>
        <Chart data={timeseriesData} />
      </Modal>

      {/* Modal de Informações */}
      <Modal isOpen={isInfoModalOpen} onClose={() => setIsInfoModalOpen(false)}>
        {renderInfoModalContent()}
      </Modal>
    </div>
  );
};

export default SourceSinkPage;