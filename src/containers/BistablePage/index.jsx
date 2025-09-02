import { useState, useEffect, useCallback } from 'react';
import BistableChart from '../../components/BistableChart';
import SpatiotemporalChart from '../../components/SpatiotemporalChart';
import Input from '../../components/Input';
import Button from '../../components/Button';
import SimulationWorker from '../../simulation_bistable.worker.js?worker';
import './styles.css';

const BistablePage = ({ onBack }) => {
  const [simulationData, setSimulationData] = useState([]);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [worker, setWorker] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [viewMode, setViewMode] = useState('line');

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

  useEffect(() => {
    const simulationWorker = new SimulationWorker();
    setWorker(simulationWorker);

    simulationWorker.onmessage = (e) => {
      setSimulationData(e.data);
      setCurrentFrame(0);
      setLoading(false);
      setIsPlaying(true);
    };

    return () => {
      simulationWorker.terminate();
    };
  }, []);

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
      }, 50);
    }
    return () => clearInterval(interval);
  }, [isPlaying, simulationData]);

  const handleChange = useCallback((e, name) => {
    const value = parseFloat(e.target.value);
    setEditableParams((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleSimularClick = useCallback(() => {
    if (worker) {
      setLoading(true);
      setSimulationData([]);
      setIsPlaying(false);
      worker.postMessage(editableParams);
    }
  }, [worker, editableParams]);

  const handleSliderChange = (e) => {
    setIsPlaying(false);
    setCurrentFrame(parseInt(e.target.value, 10));
  };
  
  const currentChartData = simulationData[currentFrame]?.data;

  return (
    <div className="page-container">
      <Button onClick={onBack}>Voltar para Home</Button>
      <h1>Modelo Bistable 1D</h1>

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

      {viewMode === 'line' ? (
        <BistableChart data={currentChartData} />
      ) : (
        <SpatiotemporalChart simulationData={simulationData} currentFrame={currentFrame} />
      )}
      
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