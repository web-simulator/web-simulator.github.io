import { useState, useEffect, useCallback } from 'react';
import FHNChart from '../../components/FHNChart';
import SpatiotemporalChart from '../../components/SpatiotemporalChart';
import Input from '../../components/Input';
import Button from '../../components/Button';
import Modal from '../../components/Modal';
import Chart from '../../components/Chart';
import SimulationWorker from '../../simulation_fhn.worker.js?worker';
import './styles.css';

const FitzHughNagumoPage = ({ onBack }) => {
  // Estados para gerenciar a simulação
  const [simulationData, setSimulationData] = useState([]);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [worker, setWorker] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [initialCondition, setInitialCondition] = useState('left_pulse');
  const [viewMode, setViewMode] = useState('line');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedX, setSelectedX] = useState(null);

  // Parâmetros da simulação que o usuário pode alterar
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

  // Configura o Worker 
  useEffect(() => {
    const simulationWorker = new SimulationWorker();
    setWorker(simulationWorker);

    // Recebe os dados da simulação.
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

  // Simulação em um loop
  useEffect(() => {
    let interval;
    if (isPlaying && simulationData.length > 0) {
      interval = setInterval(() => {
        setCurrentFrame((prevFrame) => {
          const nextFrame = prevFrame + 1;
          if (nextFrame >= simulationData.length) {
            setIsPlaying(false);
            return prevFrame;
          }
          return nextFrame;
        });
      }, 10);
    }
    return () => clearInterval(interval); // Limpa o intervalo 
  }, [isPlaying, simulationData]);

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
      // Envia os parâmetros e a condição inicial para o worker
      worker.postMessage({ ...editableParams, initialCondition });
    }
  }, [worker, editableParams, initialCondition]);

  // Lida com a mudança no controle deslizante de tempo
  const handleSliderChange = (e) => {
    setIsPlaying(false);
    setCurrentFrame(parseInt(e.target.value, 10));
  };
  
  // Clique no gráfico de cores para mostrar o modal
  const handlePointClick = useCallback((xIndex) => {
    setSelectedX(xIndex);
    setIsModalOpen(true);
  }, []);

  // Filtra a série com base no 'selectedX'.
  const getTimeseriesForPoint = () => {
    if (selectedX === null || simulationData.length === 0) return [];
    return simulationData.map(frame => ({
      tempo: parseFloat(frame.time),
      v: frame.data[selectedX].v,
      h: frame.data[selectedX].w,
    }));
  };

  const currentChartData = simulationData[currentFrame]?.data || [];
  const timeseriesData = getTimeseriesForPoint();

  return (
    <div className="page-container">
      <Button onClick={onBack}>Voltar para Home</Button>
      <h1>Modelo FitzHugh-Nagumo 1D</h1>

      <div className="params-container">
        {/* Input para selecionar a condição inicial */}
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
        
        {/* Inputs para os parâmetros da simulação */}
        {Object.keys(editableParams).map((key) => (
          <Input
            key={key}
            label={key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ')}
            value={editableParams[key]}
            onChange={(e) => handleChange(e, key)}
          />
        ))}
      </div>

      {/* Controles da simulação */}
      <div className="button-container">
        <Button onClick={handleSimularClick} disabled={loading}>
          {loading ? 'Simulando...' : 'Simular'}
        </Button>
        <Button onClick={() => setIsPlaying(!isPlaying)} disabled={simulationData.length === 0}>
          {isPlaying ? 'Pausar' : 'Retomar'}
        </Button>
        <Button onClick={() => setViewMode(viewMode === 'line' ? 'color' : 'line')} disabled={simulationData.length === 0}>
          {viewMode === 'line' ? 'Gráfico de Cores' : 'Gráfico de Linhas'}
        </Button>
      </div>

      {/* Renderiza o gráfico de linha ou de cores */}
      {viewMode === 'line' ? (
        <FHNChart data={currentChartData} />
      ) : (
        <SpatiotemporalChart simulationData={simulationData} currentFrame={currentFrame} onPointClick={handlePointClick} />
      )}

      {/* Renderiza o controle deslizante de tempo */}
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

      {/* Modal para exibir o gráfico de um ponto clicado. */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
        <h2>Potencial em X = {selectedX !== null ? (selectedX * editableParams.dx).toFixed(2) : ''}</h2>
        <Chart data={timeseriesData} />
      </Modal>
    </div>
  );
};

export default FitzHughNagumoPage;