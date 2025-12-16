import { useState, useEffect, useCallback } from 'react';
import HeatmapChart from '../../components/HeatmapChart';
import Colorbar from '../../components/Colorbar';
import Input from '../../components/Input';
import Button from '../../components/Button';
import Modal from '../../components/Modal';
import Chart from '../../components/Chart';
import MS2DWorker from '../../simulation_2d.worker.js?worker';
import Minimal2DWorker from '../../simulation_minimal_2d.worker.js?worker';
import { useTranslation } from 'react-i18next';
import './styles.css';

// Valores padrão do Minimal Model
const DEFAULT_MINIMAL_PARAMS = {
  endo: { // Endocárdio
    u_u: 1.56, theta_vminus: 0.2, theta_o: 0.006, tau_v1minus: 75.0, tau_v2minus: 10.0,
    tau_w1minus: 6.0, tau_w2minus: 140.0, k_wminus: 200.0, u_wminus: 0.016,
    tau_wplus: 280.0, tau_fi: 0.15, tau_o1: 470.0, tau_o2: 6.0, tau_so1: 40.0,
    tau_so2: 1.2, k_so: 2.0, u_so: 0.65, tau_s2: 2.0, tau_si: 2.9013,
    tau_winf: 0.0273, w_infstar: 0.78
  },
  myo: { // Miócardio
    u_u: 1.61, theta_vminus: 0.1, theta_o: 0.005, tau_v1minus: 80.0, tau_v2minus: 1.4506,
    tau_w1minus: 70.0, tau_w2minus: 8.0, k_wminus: 200.0, u_wminus: 0.016,
    tau_wplus: 280.0, tau_fi: 0.117, tau_o1: 410.0, tau_o2: 7.0, tau_so1: 91.0,
    tau_so2: 0.8, k_so: 2.1, u_so: 0.6, tau_s2: 4.0, tau_si: 3.3849,
    tau_winf: 0.01, w_infstar: 0.5
  },
  epi: { // Epicardio
    u_u: 1.55, theta_vminus: 0.006, theta_o: 0.006, tau_v1minus: 60.0, tau_v2minus: 1150.0,
    tau_w1minus: 60.0, tau_w2minus: 15.0, k_wminus: 65.0, u_wminus: 0.03,
    tau_wplus: 200.0, tau_fi: 0.165, tau_o1: 400.0, tau_o2: 6.0, tau_so1: 30.0181,
    tau_so2: 0.9957, k_so: 2.0458, u_so: 0.65, tau_s2: 16.0, tau_si: 1.8875,
    tau_winf: 0.07, w_infstar: 0.94
  }
};

const StimulusEditor = ({ stimulus, onUpdate, onRemove, index }) => {
  const { t } = useTranslation();
  const handleParamChange = (name, value) => {
    onUpdate(stimulus.id, { ...stimulus, [name]: value });
  };

  // Lida com a mudança do formato dos estimulos 
  const handleShapeParamChange = (shape, name, value) => {
    onUpdate(stimulus.id, { ...stimulus, [shape]: { ...stimulus[shape], [name]: value } });
  };

  return (
    <div className="stimulus-editor">
      <h4>
        {t('common.stimulus')} {index + 1}
        {index > 0 && <Button onClick={() => onRemove(stimulus.id)} style={{ float: 'right', padding: '5px 10px', fontSize: '12px' }}>{t('common.remove')}</Button>}
      </h4>
      <div className="params-container">
        {index === 0 ? (
          <Input label={t('params.startTime')} value={stimulus.startTime} onChange={(e) => handleParamChange('startTime', parseFloat(e.target.value))} />
        ) : (
          <Input label={t('params.intervalo')} value={stimulus.interval} onChange={(e) => handleParamChange('interval', parseFloat(e.target.value))} />
        )}
        <Input label={t('params.duracao')} value={stimulus.duration} onChange={(e) => handleParamChange('duration', parseFloat(e.target.value))} />
        <Input label={t('params.amplitude')} value={stimulus.amplitude} onChange={(e) => handleParamChange('amplitude', parseFloat(e.target.value))} />
        
        {/* Seleção para a forma do estímulo */}
        <div className="input-container">
          <label>{t('common.shape')}</label>
          <select value={stimulus.shape} onChange={(e) => handleParamChange('shape', e.target.value)}>
            <option value="rectangle">{t('common.rectangle')}</option>
            <option value="circle">{t('common.circle')}</option>
          </select>
        </div>
        
        {/* Mostra os inputs com as informações decada estimulo */}
        {stimulus.shape === 'rectangle' ? (
          Object.keys(stimulus.rectParams).map(key => (
            <Input key={key} label={t(`params.${key}`) || key} value={stimulus.rectParams[key]} onChange={(e) => handleShapeParamChange('rectParams', key, parseFloat(e.target.value))} />
          ))
        ) : (
          Object.keys(stimulus.circleParams).map(key => (
            <Input key={key} label={t(`params.${key}`) || key} value={stimulus.circleParams[key]} onChange={(e) => handleShapeParamChange('circleParams', key, parseFloat(e.target.value))} />
          ))
        )}
      </div>
    </div>
  );
};

// Pagina principal
const Model2DPage = ({ onBack }) => {
  const { t } = useTranslation();
  const [simulationResult, setSimulationResult] = useState(null);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [worker, setWorker] = useState(null); 
  const [loading, setLoading] = useState(false); 
  const [isPlaying, setIsPlaying] = useState(false); 
  const [simulationSpeed, setSimulationSpeed] = useState(50);
  const [progress, setProgress] = useState(0);
  const [remainingTime, setRemainingTime] = useState(null);
  const [selectedModel, setSelectedModel] = useState('ms2d'); 

  // Edição de parâmetros do Minimal
  const [minimalCustomParams, setMinimalCustomParams] = useState(DEFAULT_MINIMAL_PARAMS);

  const [ms2dParams, setMs2dParams] = useState({
    sigma_l: 0.004, 
    sigma_t: 0.001, 
    angle: 0,       
    Tau_in: 0.3,
    Tau_out: 6.0,
    Tau_open: 120.0,
    Tau_close: 140.0,
    gate: 0.13,
    L: 10,
    dt: 0.1,
    dx: 0.1,
    totalTime: 5000,
    downsamplingFactor: 10,
  });

  const [minimalParams, setMinimalParams] = useState({
    cellType: 'epi',
    sigma_l: 0.004, 
    sigma_t: 0.001, 
    angle: 0,       
    L: 10,
    dt: 0.1,
    dx: 0.1,
    totalTime: 2000,
    downsamplingFactor: 10,
  });

  const [stimuli, setStimuli] = useState([
    {
      id: 1, 
      startTime: 0, 
      interval: 0, 
      duration: 2,
      amplitude: 1.0,
      shape: 'rectangle',
      rectParams: { x1: 0.0, y1: 0.0, x2: 1, y2: 10.0 }, 
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

  const [fibrosisParams, setFibrosisParams] = useState({
    enabled: false, 
    type: 'compacta',
    conductivity: 0.0, 
    density: 0.1, 
    regionSize: 0.2, 
    seed: Date.now(),
    distribution: 'random',
    shape: 'rectangle',
    rectParams: { x1: 2.0, y1: 2.0, x2: 8.0, y2: 8.0 },
    circleParams: { cx: 5.0, cy: 5.0, radius: 2.0 },
    regionParams: { x1: 2.0, y1: 2.0, x2: 8.0, y2: 8.0 },
    borderZone: 0.0
  });

  // Parâmetros Transmuralidade
  const [transmuralityParams, setTransmuralityParams] = useState({
    enabled: false,
    endo_tau: 80.0,
    mid_tau: 140.0,
    epi_tau: 70.0,
    mid_start: 30, 
    epi_start: 60  
  });

  // Modal para o gráfico do ponto clicado
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [selectedPoint, setSelectedPoint] = useState(null);

  // Adiciona um novo estímulo à lista
  const addStimulus = () => {
    const newStimulus = {
      id: Date.now(),
      startTime: 0,
      interval: 200, 
      duration: 2,
      amplitude: 1.0,
      shape: 'rectangle',
      rectParams: { x1: 0, y1: 0, x2: 0.1, y2: 1.0 },
      circleParams: { cx: 0.5, cy: 0.5, radius: 0.1 }
    };
    setStimuli(prev => [...prev, newStimulus]);
  };

  // Remover um estímulo da lista
  const removeStimulus = (id) => {
    setStimuli(prev => prev.filter(s => s.id !== id));
  };

  // Atualizar os dados de um estímulo
  const updateStimulus = (id, updatedStimulus) => {
    setStimuli(prev => prev.map(s => s.id === id ? updatedStimulus : s));
  };
  
  // Configura o worker
  useEffect(() => {
    let simulationWorker;
    if (selectedModel === 'minimal') {
      simulationWorker = new Minimal2DWorker();
    } else {
      simulationWorker = new MS2DWorker();
    }
    
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

    // Função de limpeza
    return () => {
      simulationWorker.terminate();
    };
  }, [selectedModel]);

  // Simulação em um loop com velocidade ajustável
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

  // Atualizar os parâmetros
  const handleParamChange = (setter) => useCallback((e, name) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : (e.target.type === 'select-one' ? e.target.value : parseFloat(e.target.value));
    setter((prev) => ({ ...prev, [name]: value }));
  }, [setter]);
  
  // parametrod do modelo e da fibrose
  const handleMs2dChange = handleParamChange(setMs2dParams);
  const handleMinimalChange = handleParamChange(setMinimalParams);
  const handleFibrosisChange = handleParamChange(setFibrosisParams);
  const handleTransmuralityChange = handleParamChange(setTransmuralityParams);

  const handleFibrosisNestedChange = useCallback((parentKey, name, value) => {
    setFibrosisParams(prev => ({
      ...prev,
      [parentKey]: {
        ...prev[parentKey],
        [name]: parseFloat(value)
      }
    }));
  }, []);

  const handleMinimalCustomChange = (param, value) => {
    const activeType = minimalParams.cellType;
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
      setSimulationResult(null); 
      setIsPlaying(false);
      setProgress(0); 
      setRemainingTime(null);
      
      const params = selectedModel === 'ms2d' ? ms2dParams : minimalParams;
      const totalSteps = params.totalTime / params.dt;
      const maxFrames = 1000;
      const safeDownsampling = Math.ceil(totalSteps / maxFrames);
      const finalDownsampling = Math.max(params.downsamplingFactor, safeDownsampling);

      worker.postMessage({
        modelType: selectedModel,
        ...params,
        downsamplingFactor: finalDownsampling, 
        stimuli, 
        fibrosisParams,
        transmuralityParams,
        minimalCellParams: minimalCustomParams
      });
    }
  }, [worker, selectedModel, ms2dParams, minimalParams, stimuli, fibrosisParams, transmuralityParams, minimalCustomParams]);

  // barra de tempo
  const handleSliderChange = (e) => {
    setIsPlaying(false);
    setCurrentFrame(parseInt(e.target.value, 10));
  };
  
  // Abre o modal ao clicar em um ponto
  const handlePointClick = useCallback((point) => {
    setSelectedPoint(point); 
    setIsModalOpen(true); 
  }, []);

  // Gera os dados do gráfico do ponto clicado
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

  let currentChartData = null;
  let currentFibrosisMap = null;
  let N_dimension = 0;

  if (simulationResult) {
      const { frames, fibrosis, N } = simulationResult;
      N_dimension = N;
      const start = currentFrame * N * N;
      const end = start + N * N;
      currentChartData = frames.subarray(start, end);
      currentFibrosisMap = fibrosis; 
  }

  const timeseriesData = getTimeseriesForPoint(); 

  // Função para formatar o tempo
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
      <Button onClick={onBack}>{t('common.back')}</Button>
      <h1>{t('home.models.model_2d.title')}</h1>
      
      <div className="params-container">
        <div className="input-container">
          <label>{t('common.select_model')}</label>
          <select value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)}>
            <option value="ms2d">Mitchell-Schaeffer</option>
            <option value="minimal">Minimal Model</option>
          </select>
        </div>
      </div>

      <h2>{t('common.simulation_params')}</h2>
      <div className="params-container">
        {selectedModel === 'ms2d' ? (
          Object.keys(ms2dParams).map((key) => (
            <Input 
              key={key} 
              label={t(`params.${key}`) || key} 
              value={ms2dParams[key]} 
              onChange={(e) => handleMs2dChange(e, key)} 
            />
          ))
        ) : (
          <>
            {!transmuralityParams.enabled && (
                <div className="input-container">
                <label>{t('params.cellType')}</label>
                <select value={minimalParams.cellType} onChange={(e) => handleMinimalChange(e, 'cellType')}>
                    <option value="epi">{t('params.epi')}</option>
                    <option value="endo">{t('params.endo')}</option>
                    <option value="myo">{t('params.myo')}</option>
                </select>
                </div>
            )}
            {Object.keys(minimalParams).filter(k => k !== 'cellType').map((key) => (
              <Input 
                key={key} 
                label={t(`params.${key}`) || key} 
                value={minimalParams[key]} 
                onChange={(e) => handleMinimalChange(e, key)} 
              />
            ))}
          </>
        )}
      </div>

      {/* Parâmetros de célula */}
      {selectedModel === 'minimal' && (
        <div className="params-section">
            <h3 style={{marginTop: '10px'}}>Parâmetros da Célula ({t(`params.${minimalParams.cellType}`)})</h3>
            <div className="params-container">
                {Object.keys(minimalCustomParams[minimalParams.cellType]).map(key => (
                    <Input 
                        key={key}
                        label={key}
                        value={minimalCustomParams[minimalParams.cellType][key]}
                        onChange={(e) => handleMinimalCustomChange(key, e.target.value)}
                    />
                ))}
            </div>
        </div>
      )}

      <h2>{t('modals.multiple.protocol_title')}</h2>
      {stimuli.map((stim, index) => (
        <StimulusEditor 
          key={stim.id}
          index={index}
          stimulus={stim}
          onUpdate={updateStimulus}
          onRemove={removeStimulus}
        />
      ))}
      <Button onClick={addStimulus} style={{ marginTop: '10px' }}>{t('common.add_stimulus')}</Button>

      <h2>{t('common.fibrosis')} / {t('common.transmurality')}</h2>
      <div className="params-container">
          {/* Caixinha de Fibrose e Transmuralidade */}
          <div className="input-container" style={{ gridColumn: '1 / -1', display: 'flex', gap: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <label htmlFor="fibrosis-enabled">{t('common.enable_fibrosis')}</label>
                  <input type="checkbox" id="fibrosis-enabled" checked={fibrosisParams.enabled} onChange={(e) => setFibrosisParams(prev => ({...prev, enabled: e.target.checked}))} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <label htmlFor="transmurality-enabled">{t('common.enable_transmurality')}</label>
                  <input type="checkbox" id="transmurality-enabled" checked={transmuralityParams.enabled} onChange={(e) => setTransmuralityParams(prev => ({...prev, enabled: e.target.checked}))} />
              </div>
          </div>
           
          {fibrosisParams.enabled && <>
              <h3 style={{ gridColumn: '1 / -1', marginTop: '10px' }}>{t('common.fibrosis')}</h3>
              {/* Seletor do Tipo de Fibrose */}
              <div className="input-container">
                <label>{t('common.fibrosis_type')}</label>
                <select value={fibrosisParams.type} onChange={(e) => handleFibrosisChange(e, 'type')}>
                  <option value="compacta">{t('common.compact')}</option>
                  <option value="difusa">{t('common.diffuse')}</option>
                </select>
              </div>

              {/* Seletor de Distribuição*/}
              {fibrosisParams.type === 'compacta' && (
                <div className="input-container">
                  <label>{t('common.distribution')}</label>
                  <select value={fibrosisParams.distribution} onChange={(e) => handleFibrosisChange(e, 'distribution')}>
                    <option value="random">{t('common.random')}</option>
                    <option value="region">{t('common.region_defined')}</option>
                  </select>
                </div>
              )}

              <Input label={t('params.conductivity')} value={fibrosisParams.conductivity} onChange={(e) => handleFibrosisChange(e, 'conductivity')} />
              
              {/* Oculta densidade e seed se for Compacta com Região Definida */}
              {!(fibrosisParams.type === 'compacta' && fibrosisParams.distribution === 'region') && (
                <>
                  <Input label={t('params.density')} value={fibrosisParams.density} onChange={(e) => handleFibrosisChange(e, 'density')} />
                  <Input label={t('params.seed')} value={fibrosisParams.seed} onChange={(e) => handleFibrosisChange(e, 'seed')} />
                </>
              )}

              {/* Parâmetros Para Fibrose Compacta com Região Definida */}
              {fibrosisParams.type === 'compacta' && fibrosisParams.distribution === 'region' && (
                <>
                  <div className="input-container">
                    <label>{t('common.shape')}</label>
                    <select value={fibrosisParams.shape} onChange={(e) => handleFibrosisChange(e, 'shape')}>
                      <option value="rectangle">{t('common.rectangle')}</option>
                      <option value="circle">{t('common.circle')}</option>
                    </select>
                  </div>

                  {/* Input para Border Zone */}
                  <Input label={t('params.border_zone')} value={fibrosisParams.borderZone} onChange={(e) => handleFibrosisChange(e, 'borderZone')} />

                  {fibrosisParams.shape === 'rectangle' ? (
                    Object.keys(fibrosisParams.rectParams).map(key => (
                      <Input 
                        key={`rect-${key}`} 
                        label={t(`params.${key}`) || key} 
                        value={fibrosisParams.rectParams[key]} 
                        onChange={(e) => handleFibrosisNestedChange('rectParams', key, e.target.value)} 
                      />
                    ))
                  ) : (
                    Object.keys(fibrosisParams.circleParams).map(key => (
                      <Input 
                        key={`circ-${key}`} 
                        label={t(`params.${key}`) || key} 
                        value={fibrosisParams.circleParams[key]} 
                        onChange={(e) => handleFibrosisNestedChange('circleParams', key, e.target.value)} 
                      />
                    ))
                  )}
                </>
              )}

              {/* Parâmetros Para Fibrose Difusa*/}
              {fibrosisParams.type === 'difusa' && (
                <>
                  {Object.keys(fibrosisParams.regionParams).map(key => (
                    <Input 
                      key={`fib-${key}`}
                      label={t(`params.${key}`) || key} 
                      value={fibrosisParams.regionParams[key]} 
                      onChange={(e) => handleFibrosisNestedChange('regionParams', key, e.target.value)} 
                    />
                  ))}
                </>
              )}
          </>
          }

          {/* Parâmetros de Transmuralidade */}
          {transmuralityParams.enabled && (
            <>
              <h3 style={{ gridColumn: '1 / -1', marginTop: '10px', borderTop: '1px solid #ccc', paddingTop: '10px' }}>{t('common.transmurality')}</h3>
              {selectedModel === 'ms2d' ? (
                  <>
                    <Input label={t('params.endo_tau')} value={transmuralityParams.endo_tau} onChange={(e) => handleTransmuralityChange(e, 'endo_tau')} />
                    <Input label={t('params.mid_tau')} value={transmuralityParams.mid_tau} onChange={(e) => handleTransmuralityChange(e, 'mid_tau')} />
                    <Input label={t('params.epi_tau')} value={transmuralityParams.epi_tau} onChange={(e) => handleTransmuralityChange(e, 'epi_tau')} />
                  </>
              ) : ("")}
              <Input label={t('params.mid_start')} value={transmuralityParams.mid_start} onChange={(e) => handleTransmuralityChange(e, 'mid_start')} />
              <Input label={t('params.epi_start')} value={transmuralityParams.epi_start} onChange={(e) => handleTransmuralityChange(e, 'epi_start')} />
            </>
          )}
      </div>

      <div className="button-container">
        <Button onClick={handleSimularClick} disabled={loading}>{loading ? t('common.simulating') : t('common.simulate')}</Button>
        <Button onClick={() => setIsPlaying(!isPlaying)} disabled={!simulationResult}>{isPlaying ? t('common.pause') : t('common.resume')}</Button>
      </div>

      {/*Barra de Progresso com Estimativa */}
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

      <div className="chart-colorbar-wrapper">
        <HeatmapChart 
            data={currentChartData} 
            nCols={N_dimension} 
            maxValue={selectedModel === 'minimal' ? 2.0 : 1.0} 
            onPointClick={handlePointClick}
            fibrosisMap={currentFibrosisMap} 
            fibrosisConductivity={fibrosisParams.conductivity}
        />
        {simulationResult && <Colorbar maxValue={selectedModel === 'minimal' ? 2.0 : 1.0} minValue={0} />}
      </div>

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

      {/* Botão e Modal de Informações */}
      <div style={{ marginTop: '20px' }}>
        <Button onClick={() => setIsInfoModalOpen(true)}>
          {t('common.more_info')}
        </Button>
      </div>
      
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
        <h2>
          Potencial no Ponto (
            {selectedPoint ? `x: ${(selectedPoint.j * (selectedModel === 'ms2d' ? ms2dParams.dx : minimalParams.dx)).toFixed(2)}, y: ${(selectedPoint.i * (selectedModel === 'ms2d' ? ms2dParams.dx : minimalParams.dx)).toFixed(2)}` : ''}
          )
        </h2>
        <Chart data={timeseriesData} />
      </Modal>

      {/* Modal para Informações */}
      <Modal isOpen={isInfoModalOpen} onClose={() => setIsInfoModalOpen(false)}>
        <div className="info-modal-content">
          <h2>{t('home.models.model_2d.title')}</h2>
          
          {selectedModel === 'ms2d' ? (
            <>
              <h3>{t('modals.math_model')} (Mitchell-Schaeffer)</h3>
              <p>{t('modals.ms2d.desc')}</p>
              <ul>
                <li><code>{t('modals.ms2d.eq')}</code></li>
                <li><code>{t('modals.single.eq_h1')}</code></li>
                <li><code>{t('modals.single.eq_h2')}</code></li>
              </ul>
              <h3>{t('modals.param_meaning')}</h3>
              <ul>
                <li>{t('params.sigma_l')}</li>
                <li>{t('params.sigma_t')}</li>
                <li>{t('params.angle')}</li>
                <li>{t('params.Tau_in')}</li>
                <li>{t('params.Tau_out')}</li>
                <li>{t('params.Tau_open')}</li>
                <li>{t('params.Tau_close')}</li>
                <li>{t('params.gate')}</li>
              </ul>
            </>
          ) : (
            <>
              <h3>{t('modals.math_model')} (Minimal Model)</h3>
              <p>{t('modals.minimal2d.desc')}</p>
              <ul>
                <li><code>{t('modals.minimal2d.eq_u')}</code></li>
                <li><code>{t('modals.minimal2d.eq_v')}</code></li>
                <li><code>{t('modals.minimal2d.eq_w')}</code></li>
                <li><code>{t('modals.minimal2d.eq_s')}</code></li>
              </ul>
              <p>{t('modals.minimal2d.currents')}</p>

              <h3>{t('modals.param_meaning')}</h3>
              <ul>
                <li>{t('params.sigma_l')}</li>
                <li>{t('params.sigma_t')}</li>
                <li>{t('params.angle')}</li>
                <li>{t('params.cellType')}</li>
              </ul>
            </>
          )}
          
          <h3>{t('modals.numerical_method')}</h3>
          <p>{t('modals.ms2d.method')}</p>

          <h3>{t('modals.ms2d.fibrosis_title')}</h3>
          <p>{t('modals.ms2d.fibrosis_desc')}</p>
          <ul>
            <li>{t('params.conductivity')}</li>
            <li>{t('params.density')}</li>
            <li>{t('params.seed')}</li>
            <li>{t('params.border_zone')}</li>
          </ul>

          {selectedModel === 'ms2d' && (
            <>
              <h3>{t('modals.ms2d.transmurality_title')}</h3>
              <p>{t('modals.ms2d.transmurality_desc')}</p>
              <ul>
                <li>{t('params.endo_tau')}</li>
                <li>{t('params.mid_tau')}</li>
                <li>{t('params.epi_tau')}</li>
                <li>{t('params.mid_start')}</li>
                <li>{t('params.epi_start')}</li>
              </ul>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default Model2DPage;