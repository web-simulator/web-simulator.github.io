import { useState, useEffect, useCallback } from 'react';
import HeatmapChart from '../../components/HeatmapChart';
import Colorbar from '../../components/Colorbar';
import Input from '../../components/Input';
import Button from '../../components/Button';
import Modal from '../../components/Modal';
import Chart from '../../components/Chart';
import SimulationWorker from '../../simulation_2d.worker.js?worker';
import './styles.css';

const Model2DPage = ({ onBack }) => {
  const [simulationData, setSimulationData] = useState([]);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [worker, setWorker] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [simulationSpeed, setSimulationSpeed] = useState(50);
  const [modelType, setModelType] = useState('diffusion');
  const [stimulusProtocol, setStimulusProtocol] = useState('single');

  // Parâmetros para o modelo de Difusão Simples
  const [diffusionParams, setDiffusionParams] = useState({
    valor_inicial: 50,
    D: 0.1, 
    L: 1,
    dt: 0.001,
    dx: 0.05,
    totalTime: 1,
    downsamplingFactor: 10,
  });

  // Parâmetros para o modelo de MS 2D
  const [ms2dParams, setMs2dParams] = useState({
    k: 0.002,
    Tau_in: 0.3,
    Tau_out: 6.0,
    Tau_open: 120.0,
    Tau_close: 150.0,
    gate: 0.13,
    L: 10,
    dt: 0.1,
    dx: 0.2,
    totalTime: 1000,
    downsamplingFactor: 10,
  });

  // Parâmetros para S1-S2
  const [s1s2Params, setS1s2Params] = useState({
    num_estimulos_s1: 8,
    BCL_S1: 250,
    intervalo_S2: 180,
    duracao_estimulo: 2,
    amplitude: 1.0,
  });

  const [stimulusRegion, setStimulusRegion] = useState('rectangle'); // Guarda o formato da região do estímulo
  const [rectangleParams, setRectangleParams] = useState({}); // Parâmetros para a região retangular
  const [circleParams, setCircleParams] = useState({}); // Parâmetros para a região circular

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPoint, setSelectedPoint] = useState(null);



  // Muda os parâmetros da região de acordo com o modelo selecionado
  useEffect(() => {
    if (modelType === 'diffusion') {
      setStimulusProtocol('single');
      setRectangleParams({ x1: 0.4, y1: 0.4, x2: 0.6, y2: 0.6 });
      setCircleParams({ cx: 0.5, cy: 0.5, radius: 0.1 });
    } else if (modelType === 'ms2d') {
      setRectangleParams({ x1: 0, y1: 0, x2: 1, y2: 10 });
      setCircleParams({ cx: 5.0, cy: 5.0, radius: 1.0 });
    }
  }, [modelType]);

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
      const delay = 101 - simulationSpeed;
      interval = setInterval(() => {
        setCurrentFrame((prev) => (prev + 1 >= simulationData.length ? prev : prev + 1));
      }, delay);
    }
    return () => clearInterval(interval);
  }, [isPlaying, simulationData, simulationSpeed]);

  // Atualiza os parâmetros de estímulo quando o protocolo muda
  const handleParamChange = (setter) => useCallback((e, name) => {
    setter((prev) => ({ ...prev, [name]: parseFloat(e.target.value) }));
  }, [setter]);

  const handleDiffusionChange = handleParamChange(setDiffusionParams);
  const handleMs2dChange = handleParamChange(setMs2dParams);
  const handleS1S2Change = handleParamChange(setS1s2Params);
  const handleRectangleChange = handleParamChange(setRectangleParams);
  const handleCircleChange = handleParamChange(setCircleParams);

  // Envia os parâmetros para o worker e inicia a simulação
  const handleSimularClick = useCallback(() => {
    if (worker) {
      setLoading(true);
      setSimulationData([]);
      setIsPlaying(false);
      
      const paramsToSend = {
        modelType, stimulusProtocol, stimulusRegion, rectangleParams, circleParams, s1s2Params,
        ...(modelType === 'diffusion' ? diffusionParams : ms2dParams),
      };
      worker.postMessage(paramsToSend);
    }
  }, [worker, modelType, stimulusProtocol, stimulusRegion, diffusionParams, ms2dParams, s1s2Params, rectangleParams, circleParams]);

  // Atualiza o frame atual quando a barra de tempo é movida
  const handleSliderChange = (e) => {
    setIsPlaying(false);
    setCurrentFrame(parseInt(e.target.value, 10));
  };
  
  // Abre o modal com os dados do ponto clicado
  const handlePointClick = useCallback((point) => {
    setSelectedPoint(point);
    setIsModalOpen(true);
  }, []);

  // Extrai a série de estímulos para o ponto selecionado
  const getTimeseriesForPoint = () => {
    if (!selectedPoint || !simulationData || simulationData.length === 0) return [];
    
    return simulationData.map(frame => ({
      tempo: parseFloat(frame.time),
      v: frame.data[selectedPoint.i][selectedPoint.j],
    }));
  };

  const currentModelParams = modelType === 'diffusion' ? diffusionParams : ms2dParams; // Define quais parâmetros serão exibidos com base no modelo selecionado
  const currentChartData = simulationData[currentFrame]?.data || [];  // Pega os dados do frame atual para exibir no gráfico
  const maxValue = modelType === 'diffusion' ? currentModelParams.valor_inicial : 1.0; // Define o valor máximo para a barra de cores
  const timeseriesData = getTimeseriesForPoint();

  // Forma como os parâmetros são exibidos
  const paramTranslations = {
    valor_inicial: "Valor Inicial", D: "Coeficiente de Difusão", L: "Comprimento", dt: "dt", dx: "dx", totalTime: "Tempo Total",
    k: "k", Tau_in: "Tau in", Tau_out: "Tau out", Tau_open: "Tau open", Tau_close: "Tau close", gate: "Gate",
    num_estimulos_s1: "Nº de Estímulos S1", BCL_S1: "BCL S1", intervalo_S2: "Intervalo S2", duracao_estimulo: "Duração", amplitude: "Amplitude",
    downsamplingFactor: "Fator de Redução", radius: "Raio", cx: "Centro X", cy: "Centro Y", x1: "X1", y1: "Y1", x2: "X2", y2: "Y2",
  };


  return (
    <div className="page-container">
      <Button onClick={onBack}>Voltar para Home</Button>
      <h1>Modelos de Simulação 2D</h1>

      {/* Seleção de Modelo e Protocolo */}
      <div className="params-container">
        <div className="input-container">
          <label>Selecione o Modelo</label>
          <select value={modelType} onChange={(e) => setModelType(e.target.value)}>
            <option value="diffusion">Difusão Simples</option>
            <option value="ms2d">Mitchell-Schaeffer 2D</option>
          </select>
        </div>
        {modelType === 'ms2d' && (
          <div className="input-container">
            <label>Tipo de Protocolo</label>
            <select value={stimulusProtocol} onChange={(e) => setStimulusProtocol(e.target.value)}>
              <option value="single">Estímulo Único</option>
              <option value="s1s2">Protocolo S1-S2</option>
            </select>
          </div>
        )}
      </div>

      {/* Parâmetros da Simulação */}
      <h2>Parâmetros da Simulação</h2>
      <div className="params-container">
        {Object.keys(currentModelParams).map((key) => (
          <Input
            key={key}
            label={paramTranslations[key] || key}
            value={currentModelParams[key]}
            onChange={modelType === 'diffusion' ? (e) => handleDiffusionChange(e, key) : (e) => handleMs2dChange(e, key)}
          />
        ))}
      </div>

      {/* Parâmetros do Estímulo */}
      <h2>
        {stimulusProtocol === 's1s2' ? 'Parâmetros do Protocolo S1-S2' : 'Parâmetros da Região do Estímulo'}
      </h2>
      <div className="params-container">
        {stimulusProtocol === 's1s2' && modelType === 'ms2d' && (
            Object.keys(s1s2Params).map((key) => (
              <Input key={key} label={paramTranslations[key] || key} value={s1s2Params[key]} onChange={(e) => handleS1S2Change(e, key)} />
            ))
        )}
        <div className="input-container">
          <label>Formato da Região</label>
          <select value={stimulusRegion} onChange={(e) => setStimulusRegion(e.target.value)}>
            <option value="rectangle">Retangular</option>
            <option value="circle">Circular</option>
          </select>
        </div>
        {stimulusRegion === 'rectangle' ? (
          Object.keys(rectangleParams).map((key) => (
            <Input key={key} label={key.toUpperCase()} value={rectangleParams[key]} onChange={(e) => handleRectangleChange(e, key)} />
          ))
        ) : (
          Object.keys(circleParams).map((key) => (
            <Input key={key} label={paramTranslations[key] || key} value={circleParams[key]} onChange={(e) => handleCircleChange(e, key)} />
          ))
        )}
      </div>

      {/* botões de controle */}
      <div className="button-container">
        <Button onClick={handleSimularClick} disabled={loading}>{loading ? 'Simulando...' : 'Simular'}</Button>
        <Button onClick={() => setIsPlaying(!isPlaying)} disabled={simulationData.length === 0}>{isPlaying ? 'Pausar' : 'Retomar'}</Button>
      </div>

      {/* visualização */}
      <div className="chart-colorbar-wrapper">
        <HeatmapChart 
          data={currentChartData} 
          maxValue={maxValue}
          onPointClick={handlePointClick}
        />
        {simulationData.length > 0 && <Colorbar maxValue={maxValue} minValue={0} />}
      </div>

      {/* controles da animação */}
      {simulationData.length > 0 && (
        <>
          <div className="slider-container">
            <label>Tempo: {simulationData[currentFrame]?.time || 0}</label>
            <input type="range" min="0" max={simulationData.length - 1} value={currentFrame} onChange={handleSliderChange} className="slider" />
          </div>
          <div className="slider-container">
            <label>Velocidade da Animação</label>
            <input type="range" min="1" max="100" value={simulationSpeed} onChange={(e) => setSimulationSpeed(parseInt(e.target.value, 10))} className="slider" />
          </div>
        </>
      )}

      {/* Modal do potencial */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
        <h2>
          Potencial no Ponto (
            {selectedPoint ? `x: ${(selectedPoint.j * currentModelParams.dx).toFixed(2)}, y: ${(selectedPoint.i * currentModelParams.dx).toFixed(2)}` : ''}
          )
        </h2>
        <Chart data={timeseriesData} />
      </Modal>
    </div>
  );
};

export default Model2DPage;