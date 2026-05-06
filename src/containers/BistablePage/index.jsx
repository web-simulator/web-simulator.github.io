import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import BistableChart from '../../components/BistableChart';
import SpatiotemporalChart from '../../components/SpatiotemporalChart';
import Input from '../../components/Input';
import Button from '../../components/Button';
import Modal from '../../components/Modal';
import Chart from '../../components/Chart';
import ExportButton from '../../components/ExportButton';
import SimulationWorker from '../../simulation_bistable.worker.js?worker';
import { useTranslation } from 'react-i18next';
import ExportModal from '../../components/ExportModal';
import { export1DToGif, exportToPng, export1DToXDMF, export0DToCSV } from '../../utils/export';

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

const BistablePage = ({ onBack, isEmbedded }) => {
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
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [selectedX, setSelectedX] = useState(null);
  const chartRef = useRef(null);
  const [activeTab, setActiveTab] = useState('basic');

  // Parâmetros da simulação que o usuário pode alterar
  const [editableParams, setEditableParams] = useState({
    k: 2.0,
    A: 1.0,
    alpha: 0.1,
    L: 100,
    dx: 1,
    dt: 0.1,
    totalTime: 100,
    downsamplingFactor: 10,
  });

  // Configura Worker quando o componente é montado
  useEffect(() => {
    const simulationWorker = new SimulationWorker();
    setWorker(simulationWorker);

    // Receber os dados da simulação
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

  // Reproduzir a simulação em um loop com velocidade ajustável
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
      worker.postMessage(editableParams);
    }
  }, [worker, editableParams]);

  const handleExportGif = useCallback(async () => {
    if (simulationData.length === 0) return;

    setExporting(true);

    const labels = {
      potential: t('chart.potential_unit'),
      position: t('chart.position_unit'),
      time_ms: t('chart.time_ms')
    };

    setTimeout(async () => {
      await export1DToGif(simulationData, editableParams, 'bistable_simulation', labels, viewMode);
      setExporting(false);
    }, 100);
  }, [simulationData, editableParams, t, viewMode]);

  // Mudança no controle deslizante
  const handleSliderChange = (e) => {
    setIsPlaying(false);
    setCurrentFrame(parseInt(e.target.value, 10));
  };

  // Modal para exibir o gráfico ao clicar em um ponto
  const handlePointClick = useCallback((xIndex) => {
    setSelectedX(xIndex);
    setIsModalOpen(true);
  }, []);

  // Filtra a série com base no 'selectedX' usando useMemo
  const timeseriesData = useMemo(() => {
    if (selectedX === null || simulationData.length === 0) return [];
    return simulationData.map(frame => ({
      tempo: parseFloat(frame.time),
      v: frame.data[selectedX].v,
    }));
  }, [selectedX, simulationData]);

  const currentChartData = simulationData[currentFrame]?.data;

  // Conteúdo do Modal de Informações
  const renderInfoModalContent = () => {
    return (
      <div className="flex flex-col h-full max-h-[80vh]">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-emerald-800">{t('modals.bistable.title')}</h2>
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
              {t(`modals.bistable.tabs.${tab}`)}
              {activeTab === tab && (
                <div className="absolute bottom-0 left-0 w-full h-0.5 bg-emerald-500 animate-slideInRight" />
              )}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
          
          {activeTab === 'basic' && (
            <div className="space-y-4 animate-fadeIn">
              <h3 className="text-xl font-bold text-slate-700">{t('modals.bistable.basic.title')}</h3>
              <p className="text-slate-600 leading-relaxed text-justify">{t('modals.bistable.basic.desc')}</p>

              <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-4 mt-4">
                 <h4 className="font-semibold text-emerald-800 mb-2">
                    <i className="bi bi-lightning-charge mr-2"></i>
                    {t('modals.bistable.basic.goal')}
                 </h4>
                 <p className="text-sm text-emerald-700 leading-relaxed text-justify">
                    {t('modals.bistable.basic.goal_desc')}
                 </p>
              </div>
            </div>
          )}

          {activeTab === 'advanced' && (
            <div className="space-y-4 animate-fadeIn">
              <h3 className="text-xl font-bold text-slate-700">{t('modals.bistable.advanced.title')}</h3>
              <p className="text-slate-600 leading-relaxed text-justify">{t('modals.bistable.advanced.desc')}</p>

              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                 <h4 className="font-semibold text-slate-700 mb-2">{t('modals.bistable.advanced.kinetics')}</h4>
                 <p className="text-sm text-slate-600 text-justify">{t('modals.bistable.advanced.kinetics_desc')}</p>
              </div>

              <div className="mt-6 border-t border-slate-200 pt-4">
                 <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">{t('modals.references')}</h4>
                 <p className="text-xs text-slate-500 italic">{t('modals.bistable.advanced.ref')}</p>
              </div>
            </div>
          )}

          {activeTab === 'math' && (
            <div className="space-y-4 animate-fadeIn">
              <h3 className="text-xl font-bold text-slate-700">{t('modals.bistable.math.title')}</h3>
              <p className="text-slate-600 text-sm">{t('modals.bistable.math.desc')}</p>
              <div className="bg-slate-50 border border-slate-200 border-l-4 border-l-emerald-500 text-slate-700 p-4 rounded-r-lg font-mono text-sm space-y-2 overflow-x-auto custom-scrollbar">
                 <p>{t('modals.bistable.math.equation')}</p>
              </div>
              <h4 className="font-bold text-slate-700 mt-6">{t('modals.bistable.math.methods')}</h4>
              <p className="text-sm text-slate-600 text-justify">{t('modals.bistable.math.methods_desc')}</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Memoriza o conteúdo do modal do gráfico
  const chartModalContent = useMemo(() => (
    <>
      <h2 className="text-lg font-bold text-slate-700 mb-4">{t('bistableChart.potentialModal')} = {selectedX !== null ? (selectedX * editableParams.dx).toFixed(2) + ' cm' : ''}</h2>
      <Chart data={timeseriesData} />
    </>
  ), [selectedX, editableParams.dx, timeseriesData, t]);

  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-auto lg:overflow-hidden">
      {/* Header */}
      {!isEmbedded && (
        <header className="bg-white border-b border-slate-200 h-16 flex-none flex items-center justify-between px-6 shadow-sm z-20 sticky top-0 lg:relative">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="p-2 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-full transition-colors">
              <i className="bi bi-arrow-left text-xl"></i>
            </button>
            <h1 className="text-xl font-bold text-slate-800 hidden sm:block">{t('home.models.bistable.title')}</h1>
          </div>
        </header>
      )}

      <div className="flex-1 flex flex-col lg:flex-row lg:overflow-hidden">
        {/* Sidebar */}
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

        {/* Conteúdo Principal */}
        <main className="flex-1 bg-slate-100 relative flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 flex flex-col items-center">
            <div ref={chartRef} className="w-full max-w-5xl bg-white rounded-lg shadow-sm border border-slate-200 p-4 mb-4 min-h-100">
              {simulationData.length > 0 ? (
                <>
                  {viewMode === 'line' ? (
                    <BistableChart data={currentChartData} />
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

          {/* Barra de Ação Inferior */}
          <div className="bg-white border-t border-slate-200 p-4 shadow-lg z-20">
            <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
              
              <div className="flex flex-wrap items-center justify-center gap-3">
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
                    <ExportButton onClick={() => setIsExportModalOpen(true)} disabled={exporting} />
                    
                    <ExportModal 
                        mode="1d"
                        isOpen={isExportModalOpen} 
                        onClose={() => setIsExportModalOpen(false)}
                        onExportPng={() => exportToPng(chartRef, 'bistable_1d_plot')}
                        onExportGif={handleExportGif}
                        onExportData={() => export1DToXDMF(simulationData, editableParams, 'bistable_1d_data')}
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
                  <span className="text-xs font-mono text-slate-500 w-12">{Number(simulationData[simulationData.length - 1]?.time || 0).toFixed(0)}ms</span>

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

      {/* Modal para gráfico de ponto */}
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

export default BistablePage;