import { useState, useEffect, useCallback } from 'react';
import BistableChart from '../../components/BistableChart';
import Input from '../../components/Input';
import Button from '../../components/Button';
import SimulationWorker from '../../simulation_bistable.worker.js?worker';
import './styles.css';

const BistablePage = ({ onBack }) => {
  // Dados completos da simulação
  const [simulationData, setSimulationData] = useState([]);
  // Frame atual sendo exibido
  const [currentFrame, setCurrentFrame] = useState(0);
  // Worker
  const [worker, setWorker] = useState(null);
  // Carregando?
  const [loading, setLoading] = useState(false);
  // Play ou pause
  const [isPlaying, setIsPlaying] = useState(false);

  // Parâmetros editáveis
  const [editableParams, setEditableParams] = useState({
    k: 2.0,
    A: 1.0,
    alpha: 0.1,
    L: 100,
    dx: 1,
    dt: 0.1,
    totalTime: 100,
    downsamplingFactor: 10, // Salva 1 frame a cada 10
  });

  // Cria worker
  useEffect(() => {
    const simulationWorker = new SimulationWorker();
    setWorker(simulationWorker);

    // Recebe os dados gerados pelo worker
    simulationWorker.onmessage = (e) => {
      setSimulationData(e.data);
      setCurrentFrame(0);
      setLoading(false);
      setIsPlaying(true); // Começa a animação automaticamente
    };

    // Finaliza o worker
    return () => {
      simulationWorker.terminate();
    };
  }, []);

  // Avanço automático dos frames
  useEffect(() => {
    let interval;
    if (isPlaying && simulationData.length > 0) {
      interval = setInterval(() => {
        setCurrentFrame((prevFrame) => {
          const nextFrame = prevFrame + 1;
          // Se chegou no último frame, para a animação
          if (nextFrame >= simulationData.length) {
            setIsPlaying(false);
            return prevFrame;
          }
          return nextFrame;
        });
      }, 50); // Velocidade da animação
    }
    return () => clearInterval(interval);
  }, [isPlaying, simulationData]);

  // Atualiza parâmetros 
  const handleChange = useCallback((e, name) => {
    const value = parseFloat(e.target.value);
    setEditableParams((prev) => ({ ...prev, [name]: value }));
  }, []);

  // Inicia nova simulação
  const handleSimularClick = useCallback(() => {
    if (worker) {
      setLoading(true);
      setSimulationData([]);
      setIsPlaying(false);
      worker.postMessage(editableParams); // Envia parâmetros ao worker
    }
  }, [worker, editableParams]);

  // Mover o slider para escolher um frame manualmente
  const handleSliderChange = (e) => {
    setIsPlaying(false); // Pausa animação ao mexer no slider
    setCurrentFrame(parseInt(e.target.value, 10));
  };
  
  // Dados do gráfico no frame atual
  const currentChartData = simulationData[currentFrame]?.data;

  return (
    <div className="page-container">
      {/* Voltar para Home */}
      <Button onClick={onBack}>Voltar para Home</Button>
      <h1>Modelo Bistable 1D</h1>

      {/* Inputs dos parâmetros */}
      <div className="params-container">
        {Object.keys(editableParams).map((key) => (
          <Input
            key={key}
            label={key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ')}
            value={editableParams[key]}
            onChange={(e) => handleChange(e, key)}
          />
        ))}
      </div>

      {/* Botões de controle */}
      <div className="button-container">
        <Button onClick={handleSimularClick} disabled={loading}>
          {loading ? 'Simulando...' : 'Simular'}
        </Button>
        <Button onClick={() => setIsPlaying(!isPlaying)} disabled={simulationData.length === 0}>
          {isPlaying ? 'Pausar' : 'Retomar'}
        </Button>
      </div>

      {/* Gráfico */}
      <BistableChart data={currentChartData} />
      
      {/* Slider para navegar no tempo */}
      {simulationData.length > 0 && (
        <div className="slider-container">
            <label>Tempo: {simulationData[currentFrame]?.time || 0} ms</label>
            <input
                type="range"
                min="0"
                max={simulationData.length - 1}
                value={currentFrame}
                onChange={handleSliderChange}
                className="slider"
            />
        </div>
      )}
    </div>
  );
};

export default BistablePage;
