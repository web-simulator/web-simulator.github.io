import { useState, useEffect, useCallback } from 'react';
import FHNChart from '../../components/FHNChart';
import Input from '../../components/Input';
import Button from '../../components/Button';
import SimulationWorker from '../../simulation_fhn.worker.js?worker';
import './styles.css';

const FitzHughNagumoPage = ({ onBack }) => {
  // Dados da simulação
  const [simulationData, setSimulationData] = useState([]);
  // Frame da simulação está sendo exibido
  const [currentFrame, setCurrentFrame] = useState(0);
  // Worker
  const [worker, setWorker] = useState(null);
  // Estado de carregamento
  const [loading, setLoading] = useState(false);
  // Play/pause
  const [isPlaying, setIsPlaying] = useState(false);
  // Pulso ou reentrada
  const [initialCondition, setInitialCondition] = useState('left_pulse');

  // Parâmetros configuráveis
  const [editableParams, setEditableParams] = useState({
    k: 2.0,
    A: 1.0,
    alpha: 0.1,
    epsilon: 0.005,
    gamma: 2.0,
    L: 100,
    dx: 1,
    dt: 0.1,
    totalTime: 400,
    downsamplingFactor: 10,
  });

  // Cria o worker
  useEffect(() => {
    const simulationWorker = new SimulationWorker();
    setWorker(simulationWorker);

    // Recebe dados do worker
    simulationWorker.onmessage = (e) => {
      setSimulationData(e.data);
      setCurrentFrame(0);
      setLoading(false);
      setIsPlaying(true);
    };

    // Finaliza o worker
    return () => {
      simulationWorker.terminate();
    };
  }, []);

  // Avança os frames automaticamente se estiver em play
  useEffect(() => {
    let interval;
    if (isPlaying && simulationData.length > 0) {
      interval = setInterval(() => {
        setCurrentFrame((prevFrame) => {
          const nextFrame = prevFrame + 1;
          // Para quando chega no último frame
          if (nextFrame >= simulationData.length) {
            setIsPlaying(false);
            return prevFrame;
          }
          return nextFrame;
        });
      }, 10); // velocidade de atualização
    }
    return () => clearInterval(interval);
  }, [isPlaying, simulationData]);

  // Atualiza valores de parâmetros
  const handleChange = useCallback((e, name) => {
    const value = parseFloat(e.target.value);
    setEditableParams((prev) => ({ ...prev, [name]: value }));
  }, []);

  // Inicia uma nova simulação
  const handleSimularClick = useCallback(() => {
    if (worker) {
      setLoading(true);
      setSimulationData([]);
      setIsPlaying(false);
      worker.postMessage({ ...editableParams, initialCondition });
    }
  }, [worker, editableParams, initialCondition]);

  // Atualiza manualmente o frame pelo slider
  const handleSliderChange = (e) => {
    setIsPlaying(false);
    setCurrentFrame(parseInt(e.target.value, 10));
  };

  // Dados atuais do gráfico
  const currentChartData = simulationData[currentFrame]?.data || [];

  return (
    <div className="page-container">
      {/* Botão para voltar */}
      <Button onClick={onBack}>Voltar para Home</Button>
      <h1>Modelo FitzHugh-Nagumo 1D</h1>

      {/* Área dos parâmetros */}
      <div className="params-container">
        {/* Seletor da condição inicial */}
        <div className="input-container">
          <label>Condição Inicial</label>
          <select 
            value={initialCondition} 
            onChange={(e) => setInitialCondition(e.target.value)} 
            style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
          >
            <option value="left_pulse">Pulso na Borda</option>
            <option value="reentry">Simulação de Reentrada</option>
          </select>
        </div>
        
        {/* Inputs para editar os parâmetros */}
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
      <FHNChart data={currentChartData} />

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

export default FitzHughNagumoPage;
