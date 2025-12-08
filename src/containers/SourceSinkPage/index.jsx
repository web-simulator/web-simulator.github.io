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

const SourceSinkPage = ({ onBack }) => {
  const { t } = useTranslation();
  const [simulationResult, setSimulationResult] = useState(null);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [worker, setWorker] = useState(null); 
  const [loading, setLoading] = useState(false); 
  const [isPlaying, setIsPlaying] = useState(false); 
  const [simulationSpeed, setSimulationSpeed] = useState(50);
  const [progress, setProgress] = useState(0);
  const [remainingTime, setRemainingTime] = useState(null);

  // Parâmetros do modelo e da geometria do tecido
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
    // Parâmetros do círculo
    obstacleCx: 2.0,
    obstacleCy: 2.0,
    obstacleRadius: 1.0,
    // Parâmetros da Fenda
    slitWidthStart: 0.8, // Abertura Superior
    slitWidthEnd: 0.15   // Abertura Inferior
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

  // Estados para os modais
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [selectedPoint, setSelectedPoint] = useState(null);

  // Configura o Worker quando a página é carregada
  useEffect(() => {
    const simulationWorker = new SimulationWorker();
    setWorker(simulationWorker);
    
    // Recebe as mensagens do worker
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

    // Limpa o worker ao sair
    return () => {
      simulationWorker.terminate();
    };
  }, []);

  // Controla o loop de animação da simulação
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

  // Atualiza os parâmetros gerais
  const handleParamChange = useCallback((e, name) => {
    const value = parseFloat(e.target.value);
    setParams((prev) => ({ ...prev, [name]: value }));
  }, []);

  // Atualiza os parâmetros do estímulo
  const handleStimulusChange = useCallback((e, name) => {
    const value = parseFloat(e.target.value);
    setStimulusParams((prev) => ({ ...prev, [name]: value }));
  }, []);

  // Inicia a simulação enviando os dados para o worker
  const handleSimularClick = useCallback(() => {
    if (worker) {
      setLoading(true);
      setSimulationResult(null); 
      setIsPlaying(false);
      setProgress(0); 
      setRemainingTime(null);
      
      // Monta objetos de configuração para enviar
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

  // Controla a barra de tempo
  const handleSliderChange = (e) => {
    setIsPlaying(false);
    setCurrentFrame(parseInt(e.target.value, 10));
  };
  
  // Abre o modal com o gráfico do ponto clicado
  const handlePointClick = useCallback((point) => {
    setSelectedPoint(point); 
    setIsModalOpen(true); 
  }, []);

  // Extrai os estimulos do ponto selecionado
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
  let N_dimension = 0;

  if (simulationResult) {
      const { frames, fibrosis, N } = simulationResult;
      N_dimension = N;
      const start = currentFrame * N * N;
      const end = start + N * N;
      currentChartData = frames.subarray(start, end);
      currentGeometryMap = fibrosis; 
  }

  const timeseriesData = getTimeseriesForPoint(); 

  // Tempo restante
  const formatTime = (ms) => {
    if (!ms && ms !== 0) return '...';
    const totalSeconds = Math.ceil(ms / 1000);
    if (totalSeconds < 60) return `${totalSeconds}s`;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}m ${seconds}s`;
  };

  return (
    <div className="page-container">
      {/* Botão de voltar */}
      <Button onClick={onBack}>{t('common.back')}</Button>
      <h1>{t('home.models.source_sink.title')}</h1>
      
      {/* Seção de Geometria */}
      <div className="params-section">
        <h2>{t('common.geometry')}</h2>
        <div className="params-container">
            <Input label={t('params.obstacleCx')} value={params.obstacleCx} onChange={(e) => handleParamChange(e, 'obstacleCx')} />
            <Input label={t('params.obstacleCy')} value={params.obstacleCy} onChange={(e) => handleParamChange(e, 'obstacleCy')} />
            <Input label={t('params.obstacleRadius')} value={params.obstacleRadius} onChange={(e) => handleParamChange(e, 'obstacleRadius')} />
            <Input label={t('params.slitWidthStart')} value={params.slitWidthStart} onChange={(e) => handleParamChange(e, 'slitWidthStart')} />
            <Input label={t('params.slitWidthEnd')} value={params.slitWidthEnd} onChange={(e) => handleParamChange(e, 'slitWidthEnd')} />
        </div>
      </div>

      {/* Seção de Estímulo */}
      <div className="params-section">
        <h2>{t('common.stimulus')}</h2>
        <div className="params-container">
            <Input label={t('params.cx')} value={stimulusParams.cx} onChange={(e) => handleStimulusChange(e, 'cx')} />
            <Input label={t('params.cy')} value={stimulusParams.cy} onChange={(e) => handleStimulusChange(e, 'cy')} />
            <Input label={t('params.radius')} value={stimulusParams.radius} onChange={(e) => handleStimulusChange(e, 'radius')} />
            <Input label={t('params.startTime')} value={stimulusParams.startTime} onChange={(e) => handleStimulusChange(e, 'startTime')} />
        </div>
      </div>

      {/* Seção de Parâmetros da Simulação */}
      <div className="params-section">
        <h2>{t('common.simulation_params')}</h2>
        <div className="params-container">
          <Input label={t('params.Tau_in')} value={params.Tau_in} onChange={(e) => handleParamChange(e, 'Tau_in')} />
          <Input label={t('params.Tau_out')} value={params.Tau_out} onChange={(e) => handleParamChange(e, 'Tau_out')} />
          <Input label={t('params.Tau_open')} value={params.Tau_open} onChange={(e) => handleParamChange(e, 'Tau_open')} />
          <Input label={t('params.Tau_close')} value={params.Tau_close} onChange={(e) => handleParamChange(e, 'Tau_close')} />
          <Input label={t('params.gate')} value={params.gate} onChange={(e) => handleParamChange(e, 'gate')} />
          
          <Input label={t('params.sigma_l')} value={params.sigma_l} onChange={(e) => handleParamChange(e, 'sigma_l')} />
          <Input label={t('params.sigma_t')} value={params.sigma_t} onChange={(e) => handleParamChange(e, 'sigma_t')} />
          <Input label={t('params.angle')} value={params.angle} onChange={(e) => handleParamChange(e, 'angle')} />
          
          <Input label={t('params.L')} value={params.L} onChange={(e) => handleParamChange(e, 'L')} />
          <Input label={t('params.dx')} value={params.dx} onChange={(e) => handleParamChange(e, 'dx')} />
          <Input label={t('params.dt')} value={params.dt} onChange={(e) => handleParamChange(e, 'dt')} />
          <Input label={t('params.totalTime')} value={params.totalTime} onChange={(e) => handleParamChange(e, 'totalTime')} />
        </div>
      </div>

      {/* Botões de controle */}
      <div className="button-container">
        <Button onClick={handleSimularClick} disabled={loading}>{loading ? t('common.simulating') : t('common.simulate')}</Button>
        <Button onClick={() => setIsPlaying(!isPlaying)} disabled={!simulationResult}>{isPlaying ? t('common.pause') : t('common.resume')}</Button>
      </div>

      {/* Barra de progresso */}
      {loading && (
        <div className="progress-wrapper">
          <p className="progress-text">
            {t('common.simulating')} {progress}% 
            {remainingTime !== null && ` - ~${formatTime(remainingTime)} restantes`}
          </p>
          <div className="progress-bar-bg">
            <div className="progress-bar-fill" style={{ width: `${progress}%` }}></div>
          </div>
        </div>
      )}

      {/* Gráfico Heatmap e Barra de Cores */}
      <div className="chart-colorbar-wrapper">
        <HeatmapChart 
            data={currentChartData} 
            nCols={N_dimension} 
            maxValue={1.0} 
            onPointClick={handlePointClick}
            fibrosisMap={currentGeometryMap} 
            fibrosisConductivity={0.0} 
        />
        {simulationResult && <Colorbar maxValue={1.0} minValue={0} />}
      </div>

      {/* Controles de reprodução*/}
      {simulationResult && (
        <>
          <div className="slider-container">
            <label>{t('common.time')}: {simulationResult.times[currentFrame]?.toFixed(2) || 0}</label>
            <input type="range" min="0" max={simulationResult.totalFrames - 1} value={currentFrame} onChange={handleSliderChange} className="slider" />
          </div>
          <div className="slider-container">
            <label>{t('common.speed')}</label>
            <input type="range" min="1" max="100" value={simulationSpeed} onChange={(e) => setSimulationSpeed(parseInt(e.target.value, 10))} className="slider" />
          </div>
        </>
      )}

      {/* Botão de informações */}
      <div style={{ marginTop: '20px' }}>
        <Button onClick={() => setIsInfoModalOpen(true)}>
          {t('common.more_info')}
        </Button>
      </div>
      
      {/* Modal do gráfico de ponto */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
        <h2>
          Potencial no Ponto (
            {selectedPoint ? `x: ${(selectedPoint.j * params.dx).toFixed(2)}, y: ${(selectedPoint.i * params.dx).toFixed(2)}` : ''}
          )
        </h2>
        <Chart data={timeseriesData} />
      </Modal>

      {/* Modal de informações detalhadas */}
      <Modal isOpen={isInfoModalOpen} onClose={() => setIsInfoModalOpen(false)}>
        <div className="info-modal-content">
          <h2>{t('home.models.source_sink.title')}</h2>
          <h3>{t('modals.math_model')}</h3>
          <p>{t('modals.source_sink.desc')}</p>
          <p>{t('modals.source_sink.geometry_desc')}</p>
          <ul>
            <li><code>{t('modals.source_sink.eq')}</code></li>
          </ul>
          <h3>{t('modals.numerical_method')}</h3>
          <p>{t('modals.ms2d.method')}</p>
        </div>
      </Modal>
    </div>
  );
};

export default SourceSinkPage;