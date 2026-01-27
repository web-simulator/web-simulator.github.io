import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import MS1DChart from '../../components/MS1DChart';
import SpatiotemporalChart from '../../components/SpatiotemporalChart';
import Input from '../../components/Input';
import Button from '../../components/Button';
import Modal from '../../components/Modal';
import Chart from '../../components/Chart';
import ExportButton from '../../components/ExportButton';
import SimulationWorker from '../../simulation_ms_1d.worker.js?worker';
import { useTranslation } from 'react-i18next';
import { export1DToGif } from '../../utils/export';

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

const MitchellSchaeffer1DPage = ({ onBack }) => {
  const { t } = useTranslation();
  
  // Estados de dados e worker
  const [simulationData, setSimulationData] = useState([]);
  const [worker, setWorker] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  
  // Estados de controle de reprodução
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [simulationSpeed, setSimulationSpeed] = useState(50);
  
  // Estados de visualização
  const [viewMode, setViewMode] = useState('line');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [selectedX, setSelectedX] = useState(null);
  const chartRef = useRef(null);

  // Parâmetros da simulação que o usuário pode alterar
  const [editableParams, setEditableParams] = useState({
    k: 2.0,
    Tau_in: 0.3,
    Tau_out: 6.0,
    Tau_open: 120.0,
    Tau_close: 80.0,
    gate: 0.13,
    L: 100,
    dx: 1,
    dt: 0.05,
    totalTime: 500,
    downsamplingFactor: 10,
    inicio: 5.0,
    duracao: 1.0,
    amplitude: 1.0,
    posição_do_estímulo: 10,
    tamanho_do_estímulo: 5,
    num_estimulos: 8,
    BCL: 250
  });

  // Configura o Worker 
  useEffect(() => {
    const simulationWorker = new SimulationWorker();
    setWorker(simulationWorker);

    // Recebe os dados da simulação
    simulationWorker.onmessage = (e) => {
      setSimulationData(e.data);
      setCurrentFrame(0);
      setLoading(false);
      setIsPlaying(true);
    };

    // Função de limpeza
    return () => {
      simulationWorker.terminate();
    };
  }, []);

  // Simulação em um loop com velocidade ajustável
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

  // Atualiza os parâmetros quando o usuário muda os valores nos inputs
  const handleChange = useCallback((e, name) => {
    const value = parseFloat(e.target.value);
    setEditableParams((prev) => ({ ...prev, [name]: value }));
  }, []);

  // Inicia a simulação
  const handleSimularClick = useCallback(() => {
    if (worker) {
      setLoading(true);
      setSimulationData([]);
      setIsPlaying(false);
      // Envia os parâmetros para o worker
      worker.postMessage(editableParams);
    }
  }, [worker, editableParams]);

  // Função para exportar GIF
  const handleExportGif = useCallback(async () => {
    if (simulationData.length === 0) return;
    
    setExporting(true);
    
    const labels = {
        potential: t('chart.potential_unit'),
        position: t('chart.position_unit'),
        time_ms: t('chart.time_ms')
    };

    setTimeout(async () => {
        await export1DToGif(simulationData, editableParams, 'simulacao_ms1d', labels, viewMode);
        setExporting(false);
    }, 100);
  }, [simulationData, editableParams, t, viewMode]);

  // Mudança no controle deslizante de tempo
  const handleSliderChange = (e) => {
    setIsPlaying(false);
    setCurrentFrame(parseInt(e.target.value, 10));
  };
  
  // Clique no gráfico de cores para mostrar o modal
  const handlePointClick = useCallback((xIndex) => {
    setSelectedX(xIndex);
    setIsModalOpen(true);
  }, []);

  // Filtra com base no 'selectedX'
  const timeseriesData = useMemo(() => {
    if (selectedX === null || simulationData.length === 0) return [];
    return simulationData.map(frame => ({
      tempo: parseFloat(frame.time),
      v: frame.data[selectedX].v,
      h: frame.data[selectedX].h,
    }));
  }, [selectedX, simulationData]);

  const currentChartData = simulationData[currentFrame]?.data || [];

  const renderInfoModalContent = () => (
    <div className="info-modal-content text-slate-800 space-y-4">
      <h2 className="text-2xl font-bold text-emerald-800 mb-4">{t('home.models.ms_1d.title')}</h2>
      
      <h3 className="text-lg font-bold text-slate-700 border-b border-slate-200 pb-1 mb-2">{t('modals.math_model')}</h3>
      <p className="text-slate-600">{t('modals.ms1d.desc')}</p>
      <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 font-mono text-sm my-2 space-y-2">
        <code>{t('modals.ms1d.eq')}</code>
        <code>{t('modals.single.ms.eq_h1')}</code>
        <code>{t('modals.single.ms.eq_h2')}</code>
      </div>
      
      <h3 className="text-lg font-bold text-slate-700 border-b border-slate-200 pb-1 mb-2">{t('modals.numerical_method')}</h3>
      <p className="text-slate-600 text-sm">{t('modals.ms1d.method')}</p>

      <h3 className="text-lg font-bold text-slate-700 border-b border-slate-200 pb-1 mb-2">{t('modals.param_meaning')}</h3>
      <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-slate-600">
         {Object.keys(editableParams).map(key => (
            <li key={key}><strong className="text-slate-700">{key}:</strong> {t(`params.${key}`) || key}</li>
         ))}
      </ul>
    </div>
  );


  const chartModalContent = useMemo(() => (
    <>
      <h2 className="text-lg font-bold text-slate-700 mb-4">
        Potencial em X = {selectedX !== null ? (selectedX * editableParams.dx).toFixed(2) : ''}
      </h2>
      <Chart data={timeseriesData} />
    </>
  ), [selectedX, editableParams.dx, timeseriesData]);

  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-auto lg:overflow-hidden">
      <header className="bg-white border-b border-slate-200 h-16 flex-none flex items-center justify-between px-6 shadow-sm z-20 sticky top-0 lg:relative">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-full transition-colors">
            <i className="bi bi-arrow-left text-xl"></i>
          </button>
          <h1 className="text-xl font-bold text-slate-800 hidden sm:block">{t('home.models.ms_1d.title')}</h1>
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row lg:overflow-hidden">
        <aside className="w-full lg:w-96 bg-white border-r border-slate-200 lg:overflow-y-auto custom-scrollbar flex-none shadow-xl z-10">
          <div className="p-6 pb-6">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">{t('common.configuration')}</p>

            <SettingsSection title={t('common.view_options') || "Visualização"} defaultOpen={true}>
                 <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-700">{viewMode === 'line' ? t('common.line_chart') : t('common.color_chart')}</span>
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
                 </div>
            </SettingsSection>

            <SettingsSection title={t('common.simulation_params')} defaultOpen={true}>
                <div className="grid grid-cols-2 gap-3">
                    {Object.keys(editableParams).map((key) => (
                    <Input
                        key={key}
                        label={t(`params.${key}`) || key}
                        value={editableParams[key]}
                        onChange={(e) => handleChange(e, key)}
                        type="number"
                        className="mb-0"
                    />
                    ))}
                </div>
            </SettingsSection>
          </div>
        </aside>

        <main className="flex-1 bg-slate-100 relative flex flex-col min-h-0">
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 flex flex-col items-center">
                 <div ref={chartRef} className="w-full max-w-5xl bg-white rounded-lg shadow-sm border border-slate-200 p-4 mb-4 min-h-100">
                    {simulationData.length > 0 ? (
                        <>
                             {viewMode === 'line' ? (
                                <MS1DChart 
                                  data={currentChartData} 
                                  windowSize={editableParams.L} 
                                  scrollPosition={0} 
                                />
                            ) : (
                                <SpatiotemporalChart simulationData={simulationData} currentFrame={currentFrame} onPointClick={handlePointClick} />
                            )}
                        </>
                    ) : (
                        <div className="h-87.5 w-full flex flex-col items-center justify-center text-slate-400">
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
                            disabled={loading || exporting}
                            className={`rounded-full px-6 py-2 font-bold text-white shadow-md transition-transform active:scale-95 flex items-center gap-2 ${loading ? 'bg-slate-400 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700'}`}
                        >
                             {loading ? <span className="animate-spin"><i className="bi bi-arrow-repeat"></i></span> : <i className="bi bi-play-fill text-xl"></i>}
                             {loading ? t('common.simulating') : t('common.simulate')}
                        </button>
                        
                        {simulationData.length > 0 && (
                             <>
                                <div className="h-8 w-px bg-slate-300 mx-2"></div>
                                <button 
                                    onClick={() => setIsPlaying(!isPlaying)}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-full w-12 h-12 flex items-center justify-center shadow-md transition-transform active:scale-95"
                                    title={isPlaying ? t('common.pause') : t('common.resume')}
                                >
                                    <i className={`bi ${isPlaying ? 'bi-pause-fill' : 'bi-play-fill'} text-2xl ml-${isPlaying ? '0' : '1'}`}></i>
                                </button>

                                {/* Botão de Exportar GIF */}
                                <ExportButton 
                                    onClick={handleExportGif}
                                    label={exporting ? t('common.generating_gif') : t('common.export_result')}
                                    disabled={exporting}
                                />
                             </>
                        )}
                    </div>
                    
                    {simulationData.length > 0 && (
                        <div className="flex-1 w-full flex items-center gap-3">
                            <span className="text-xs font-mono text-slate-500 w-12 text-right">{(simulationData[currentFrame]?.time || 0)}ms</span>
                            <input 
                                type="range" 
                                min="0" 
                                max={simulationData.length - 1} 
                                value={currentFrame} 
                                onChange={handleSliderChange} 
                                className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600" 
                            />
                            <span className="text-xs font-mono text-slate-500 w-12">{(simulationData[simulationData.length-1]?.time || 0)}ms</span>
                            
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
                    
                    <Button onClick={() => setIsInfoModalOpen(true)} className="bg-slate-100 text-slate-600 hover:bg-slate-200 p-2 rounded-lg" title={t('common.more_info')}>
                        <i className="bi bi-info-circle text-lg"></i> <span className="md:hidden ml-2">{t('common.more_info')}</span>
                    </Button>
                </div>
            </div>
        </main>
      </div>

      {/* Modal para exibir o gráfico de um ponto clicado. */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
        {chartModalContent}
      </Modal>

      {/* Modal para Informações */}
      <Modal isOpen={isInfoModalOpen} onClose={() => setIsInfoModalOpen(false)}>
        {renderInfoModalContent()}
      </Modal>
    </div>
  );
};

export default MitchellSchaeffer1DPage;