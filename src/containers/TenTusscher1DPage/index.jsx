import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import SimulationWorker from '../../simulation_tentusscher_1d.worker.js?worker';
import { runGPU1DTenTusscher } from '../../utils/webgpu_tentusscher_1d';
import { export1DToGif, exportToPng, export1DToXDMF } from '../../utils/export';

// Componentes da UI
import Button from '../../components/Button';
import Input from '../../components/Input';
import Chart from '../../components/Chart';
import TenTusscher1DChart from '../../components/TenTusscher1DChart';
import SpatiotemporalChart from '../../components/SpatiotemporalChart';
import Modal from '../../components/Modal';
import ExportButton from '../../components/ExportButton';
import ExportModal from '../../components/ExportModal';

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

const DEFAULT_EDITABLE_PARAMS = {
  cellType: 'epi',
  L: 30,
  dx: 0.1,
  dt: 0.02,
  D: 0.154,
  totalTime: 500,
  downsamplingFactor: 50,
  inicio: 5.0,
  duracao: 1.0,
  amplitude: -52.0, 
  posição_do_estímulo: 5, 
  tamanho_do_estímulo: 5, 
  num_estimulos: 2,
  BCL: 1000
};

const TenTusscher1DPage = ({ onBack, isEmbedded }) => {
  const { t } = useTranslation();
  
  const [simulationData, setSimulationData] = useState([]);
  const [worker, setWorker] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [usingGPU, setUsingGPU] = useState(null);
  
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [simulationSpeed, setSimulationSpeed] = useState(50);
  
  const [viewMode, setViewMode] = useState('line');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [selectedX, setSelectedX] = useState(null);
  const chartRef = useRef(null);
  const [activeTab, setActiveTab] = useState('basic');

  const [editableParams, setEditableParams] = useState(DEFAULT_EDITABLE_PARAMS);

  useEffect(() => {
    const stdWorker = new SimulationWorker();
    setWorker(stdWorker);

    stdWorker.onmessage = (e) => {
      setSimulationData(e.data);
      setCurrentFrame(0);
      setLoading(false);
      setIsPlaying(true);
    };

    return () => stdWorker.terminate();
  }, []);

  useEffect(() => {
    let interval;
    if (isPlaying && simulationData.length > 0) {
      const delay = Math.max(0, (100 - simulationSpeed) * 2); 
      interval = setInterval(() => {
        setCurrentFrame((prevFrame) => {
          const nextFrame = prevFrame + 1;
          if (nextFrame >= simulationData.length) {
            setIsPlaying(false);
            return prevFrame;
          }
          return nextFrame;
        });
      }, delay);
    }
    return () => clearInterval(interval); 
  }, [isPlaying, simulationData, simulationSpeed]);

  const handleChange = useCallback((e, name) => {
    const value = name === 'cellType' ? e.target.value : parseFloat(e.target.value);
    setEditableParams((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleSimularClick = useCallback(async () => {
    setLoading(true);
    setSimulationData([]);
    setIsPlaying(false);
    
    try {
      if (!navigator.gpu) throw new Error("WebGPU not supported");
      const data = await runGPU1DTenTusscher(editableParams);
      setSimulationData(data);
      setUsingGPU(true);
      setCurrentFrame(0);
      setIsPlaying(true);
      setLoading(false);
    } catch (err) {
      console.warn("GPU failed, falling back to CPU", err);
      setUsingGPU(false);
      if (worker) worker.postMessage(editableParams);
    }
  }, [editableParams, worker]);

  const handleReset = useCallback(() => {
    setEditableParams(DEFAULT_EDITABLE_PARAMS);
    setSimulationData([]);
    setIsPlaying(false);
    setCurrentFrame(0);
  }, []);

  const handleSliderChange = (e) => {
    setIsPlaying(false);
    setCurrentFrame(parseInt(e.target.value, 10));
  };
  
  const handlePointClick = useCallback((xIndex) => {
    setSelectedX(xIndex);
    setIsModalOpen(true);
  }, []);

  const timeseriesData = useMemo(() => {
    if (selectedX === null || simulationData.length === 0) return [];
    
    const { inicio, duracao, amplitude, BCL, num_estimulos, dx, posição_do_estímulo, tamanho_do_estímulo, L } = editableParams;
    
    const stim_center_idx = Math.floor(posição_do_estímulo / dx);
    const stim_half_idx = Math.floor(tamanho_do_estímulo / (2 * dx));
    const stim_start_idx = Math.max(1, stim_center_idx - stim_half_idx);
    const stim_end_idx = Math.min(Math.floor(L / dx) - 2, stim_center_idx + stim_half_idx);
    const isInStimArea = selectedX >= stim_start_idx && selectedX <= stim_end_idx;

    return simulationData.map(frame => {
      const time = parseFloat(frame.time);
      return {
        tempo: time,
        v: frame.data[selectedX].v
      };
    });
  }, [selectedX, simulationData, editableParams]);

  const currentChartData = simulationData[currentFrame]?.data || [];

  const chartModalContent = useMemo(() => (
    <>
      <h2 className="text-lg font-bold text-slate-700 mb-4">
        {t('bistableChart.potentialModal', 'Potencial na Posição')} = {selectedX !== null ? (selectedX * editableParams.dx).toFixed(2) + ' mm' : ''}
      </h2>
      <div className="w-full h-[60vh] min-h-[400px]">
        <Chart data={timeseriesData} />
      </div>
    </>
  ), [selectedX, editableParams.dx, timeseriesData, t]);

  const renderInfoModalContent = () => {
    return (
      <div className="flex flex-col h-full max-h-[80vh]">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-emerald-800">{t('modals.tentusscher1d.title', 'Ten Tusscher 1D Model')}</h2>
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
              {t(`modals.ms1d.tabs.${tab}`, tab === 'basic' ? 'Básico' : tab === 'advanced' ? 'Avançado' : 'Matemática')}
              {activeTab === tab && (
                <div className="absolute bottom-0 left-0 w-full h-0.5 bg-emerald-500 animate-slideInRight" />
              )}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
          {activeTab === 'basic' && (
            <div className="space-y-4 animate-fadeIn">
              <h3 className="text-xl font-bold text-slate-700">{t('modals.tentusscher1d.basic.title', 'Conceitos Básicos')}</h3>
              <p className="text-slate-600">
                {t('modals.tentusscher1d.basic.desc', 'Esta simulação computa a propagação do potencial de ação ao longo de um cabo unidimensional (1D) usando o modelo iônico humano de Ten Tusscher et al. (2004).')}
              </p>
              <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-100">
                <h4 className="font-semibold text-emerald-800 mb-2">{t('modals.model_1d.basic.cable_concept', 'O Conceito de Cabo')}</h4>
                <p className="text-sm text-emerald-700">
                  {t('modals.tentusscher1d.gpu.desc', 'Utilizamos aceleração WebGPU para resolver mais de 17 equações diferenciais (Ca2+, Na+, K+) por célula, calculadas paralelamente. Caso a GPU falhe, um Fallback para CPU assume automaticamente o cálculo.')}
                </p>
              </div>
            </div>
          )}

          {activeTab === 'advanced' && (
            <div className="space-y-4 animate-fadeIn">
              <h3 className="text-lg font-bold text-slate-700">{t('modals.model_1d.advanced.parameters', 'Parâmetros Avançados')}</h3>
              <ul className="list-disc pl-5 text-sm text-slate-600 space-y-2">
                <li><strong>{t('params.D', 'Difusão')} (D):</strong> {t('modals.model_1d.advanced.d_desc', 'Controla a velocidade de condução.')}</li>
                <li><strong>{t('params.L', 'Comprimento')} (L):</strong> {t('modals.model_1d.advanced.l_desc', 'Tamanho do cabo em mm.')}</li>
                <li><strong>{t('modals.tentusscher1d.advanced.heterogeneity', 'Heterogeneidade Celular')}:</strong> {t('modals.tentusscher1d.advanced.heterogeneity_desc', 'Permite selecionar correntes específicas de Epicárdio, Endocárdio ou Miocárdio médio, alterando Gto e Gks.')}</li>
              </ul>
            </div>
          )}

          {activeTab === 'math' && (
            <div className="space-y-4 animate-fadeIn">
              <h3 className="text-lg font-bold text-slate-700">{t('modals.model_1d.math.equations', 'Equações Matemáticas')}</h3>
              <p className="text-slate-600 text-sm">
                {t('modals.tentusscher1d.math.desc', 'A propagação 1D do potencial V no espaço x é dada pela equação da reação-difusão:')}
              </p>
              <div className="bg-slate-50 p-3 rounded text-center overflow-x-auto text-sm border border-slate-200">
                 {t('modals.tentusscher1d.math.equation', 'dV/dt = D * d²V/dx² - (I_ion + I_stim)/Cm')}
              </div>
              <p className="text-slate-600 text-sm mt-2">
                {t('modals.tentusscher1d.math.methods_desc', 'A integração é feita no tempo usando o método de Euler para a voltagem, e Rush-Larsen analítico para a estabilidade das comportas de canal iônico. A discretização do Laplaciano ocorre por diferenças finitas centrais.')}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-auto lg:overflow-hidden">
      {!isEmbedded && (
        <header className="bg-white border-b border-slate-200 h-16 flex-none flex items-center justify-between px-6 shadow-sm z-20 sticky top-0 lg:relative">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="p-2 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-full transition-colors">
              <i className="bi bi-arrow-left text-xl"></i>
            </button>
            <h1 className="text-xl font-bold text-slate-800 hidden sm:block">{t('common.tentusscher_model', 'Ten Tusscher')}</h1>
          </div>
        </header>
      )}

      <div className="flex-1 flex flex-col lg:flex-row lg:overflow-hidden">
        <aside className="w-full lg:w-96 bg-white border-r border-slate-200 lg:overflow-y-auto custom-scrollbar flex-none shadow-xl z-10">
          <div className="p-6 pb-6">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">{t('common.configuration')}</p>

            <SettingsSection title={t('common.view_options') || "Visualização"} defaultOpen={true}>
                 <div className="flex items-center justify-between">
                     <span className="text-sm font-medium text-slate-700">{viewMode === 'line' ? t('common.line_chart', 'Gráfico de Linha') : t('common.color_chart', 'Gráfico de Cores')}</span>
                     <div className="relative inline-block w-12 h-6 align-middle select-none transition duration-200 ease-in">
                         <input 
                             type="checkbox" 
                             checked={viewMode === 'color'}
                             onChange={() => setViewMode(viewMode === 'line' ? 'color' : 'line')}
                             className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer checked:right-0 checked:border-emerald-500 right-6 border-slate-300 transition-all duration-200 top-0"
                         />
                         <label className="toggle-label block overflow-hidden h-6 rounded-full bg-slate-200 cursor-pointer checked:bg-emerald-500"></label>
                     </div>
                 </div>
            </SettingsSection>

            <SettingsSection title={t('common.tissue', 'Tecido e Célula')} defaultOpen={true}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('params.cellType', 'Tipo Celular')}</label>
                <select 
                  value={editableParams.cellType} 
                  onChange={(e) => handleChange(e, 'cellType')}
                  className="w-full text-sm p-2 border border-slate-300 rounded focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="epi">{t('params.cellEpi', 'Epicárdio')}</option>
                  <option value="endo">{t('params.cellEndo', 'Endocárdio')}</option>
                  <option value="myo">{t('params.cellMyo', 'Miocárdio Médio')}</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input label={t('params.L', 'L (mm)')} value={editableParams.L} onChange={(e) => handleChange(e, 'L')} type="number" className="mb-0" />
                <Input label={t('params.dx', 'dx (mm)')} value={editableParams.dx} onChange={(e) => handleChange(e, 'dx')} type="number" className="mb-0" />
                <Input label={t('params.D', 'Difusão')} value={editableParams.D} onChange={(e) => handleChange(e, 'D')} type="number" className="mb-0" />
              </div>
            </SettingsSection>

            <SettingsSection title={t('common.simulation', 'Simulação')} defaultOpen={true}>
              <div className="grid grid-cols-2 gap-3">
                <Input label={t('params.totalTime', 'Tempo Total (ms)')} value={editableParams.totalTime} onChange={(e) => handleChange(e, 'totalTime')} type="number" className="mb-0" />
                <Input label={t('params.dt', 'dt (ms)')} value={editableParams.dt} onChange={(e) => handleChange(e, 'dt')} type="number" className="mb-0" />
              </div>
            </SettingsSection>

            <SettingsSection title={t('common.stimulus', 'Estímulo')} defaultOpen={true}>
              <div className="grid grid-cols-2 gap-3">
                <Input label={t('params.inicio', 'Início (ms)')} value={editableParams.inicio} onChange={(e) => handleChange(e, 'inicio')} type="number" className="mb-0" />
                <Input label={t('params.duracao', 'Duração (ms)')} value={editableParams.duracao} onChange={(e) => handleChange(e, 'duracao')} type="number" className="mb-0" />
                <Input label={t('params.amplitude', 'Amplitude')} value={editableParams.amplitude} onChange={(e) => handleChange(e, 'amplitude')} type="number" className="mb-0" />
                <Input label={t('params.num_estimulos', 'Nº de Estímulos')} value={editableParams.num_estimulos} onChange={(e) => handleChange(e, 'num_estimulos')} type="number" className="mb-0" />
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <Input label={t('params.posição_do_estímulo', 'Posição Estímulo (mm)')} value={editableParams.posição_do_estímulo} onChange={(e) => handleChange(e, 'posição_do_estímulo')} type="number" className="mb-0" />
                <Input label={t('params.tamanho_do_estímulo', 'Tamanho Estímulo (mm)')} value={editableParams.tamanho_do_estímulo} onChange={(e) => handleChange(e, 'tamanho_do_estímulo')} type="number" className="mb-0" />
                <Input label={t('params.BCL', 'BCL (ms)')} value={editableParams.BCL} onChange={(e) => handleChange(e, 'BCL')} type="number" className="mb-0" />
              </div>
            </SettingsSection>

            {usingGPU !== null && (
              <div className={`mt-4 p-3 rounded-lg flex items-center justify-center gap-2 font-medium text-sm border ${usingGPU ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
                <i className={`bi ${usingGPU ? 'bi-gpu-card' : 'bi-cpu'}`}></i>
                {usingGPU ? 'WebGPU Ativo' : 'CPU Fallback'}
              </div>
            )}
          </div>
        </aside>

        <main className="flex-1 bg-slate-100 relative flex flex-col min-h-0">
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 flex flex-col items-center">
                 <div ref={chartRef} className="w-full max-w-5xl bg-white rounded-lg shadow-sm border border-slate-200 p-4 mb-4 min-h-100 flex flex-col">
                    {simulationData.length > 0 ? (
                        <>
                            {viewMode === 'line' ? (
                                <TenTusscher1DChart 
                                  data={currentChartData} 
                                />
                            ) : (
                                <SpatiotemporalChart 
                                  simulationData={simulationData} 
                                  currentFrame={currentFrame} 
                                  onPointClick={handlePointClick} 
                                  valueDomain={[-95.0, 50.0]} 
                                />
                            )}
                        </>
                    ) : (
                        <div className="h-87.5 w-full flex flex-col items-center justify-center text-slate-400">
                             <i className="bi bi-activity text-6xl mb-4 opacity-50"></i>
                             <p>{t('common.ready', 'Aguardando Simulação')}</p>
                        </div>
                    )}
                 </div>
            </div>

            <div className="bg-white border-t border-slate-200 p-4 shadow-lg z-20">
                <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
                    
                    <div className="flex flex-wrap items-center justify-center gap-3">
                        <button
                            onClick={handleSimularClick}
                            disabled={loading || exporting}
                            className={`rounded-full px-6 py-2 font-bold text-white shadow-md transition-transform active:scale-95 flex items-center gap-2 ${loading ? 'bg-slate-400 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700'}`}
                        >
                             {loading ? <span className="animate-spin"><i className="bi bi-arrow-repeat"></i></span> : <i className="bi bi-play-fill text-xl"></i>}
                             {loading ? t('common.simulating', 'Simulando...') : t('common.simulate', 'Simular')}
                        </button>

                        <button
                            onClick={handleReset}
                            className="rounded-full px-6 py-2 font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors shadow-sm flex items-center gap-2"
                            title={t('common.reset')}
                        >
                            <i className="bi bi-arrow-counterclockwise text-lg"></i> <span className="hidden sm:inline">{t('common.reset')}</span>
                        </button>

                        {simulationData.length > 0 && (
                             <>
                                <ExportButton onClick={() => setIsExportModalOpen(true)} disabled={exporting} />
                                
                                <ExportModal 
                                    mode="1d"
                                    isOpen={isExportModalOpen} 
                                    onClose={() => setIsExportModalOpen(false)}
                                    onExportPng={() => exportToPng(chartRef, 'tentusscher_1d_plot')}
                                    onExportGif={async () => {
                                        setExporting(true);
                                        const labels = {
                                            potential: t('chart.potential_unit'),
                                            position: t('chart.position_unit'),
                                            time_ms: t('chart.time_ms')
                                        };
                                        await export1DToGif(simulationData, editableParams, 'tentusscher1d_simulation', labels, viewMode);
                                        setExporting(false);
                                    }}
                                    onExportData={() => export1DToXDMF(simulationData, editableParams, 'tentusscher_1d_data')}
                                />
                                
                                <div className="h-8 w-px bg-slate-300 mx-1 hidden md:block"></div>
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
                    
                    {simulationData.length > 0 && (
                        <div className="flex-1 w-full flex items-center gap-3">
                            <span className="text-xs font-mono text-slate-500 w-12 text-right">{Number(simulationData[currentFrame]?.time || 0).toFixed(0)}ms</span>
                            <input 
                                type="range" 
                                min="0" 
                                max={simulationData.length - 1} 
                                value={currentFrame} 
                                onChange={handleSliderChange} 
                                className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600" 
                            />
                            <span className="text-xs font-mono text-slate-500 w-12">{Number(simulationData[simulationData.length-1]?.time || 0).toFixed(0)}ms</span>
                            
                            <div className="flex items-center gap-2 ml-2 border-l border-slate-200 pl-4" title={t('common.speed')}>
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
                    
                    <div className="ml-auto flex-shrink-0">
                        <Button onClick={() => setIsInfoModalOpen(true)} className="bg-slate-100 text-slate-600 hover:bg-slate-200 p-2 rounded-lg" title={t('common.more_info')}>
                            <i className="bi bi-info-circle text-lg"></i> <span className="md:hidden ml-2">{t('common.more_info')}</span>
                        </Button>
                    </div>

                </div>
            </div>
        </main>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
        {chartModalContent}
      </Modal>

      <Modal isOpen={isInfoModalOpen} onClose={() => setIsInfoModalOpen(false)}>
        {renderInfoModalContent()}
      </Modal>
    </div>
  );
};

export default TenTusscher1DPage;
