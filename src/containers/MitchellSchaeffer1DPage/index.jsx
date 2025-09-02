import { useState, useEffect, useCallback } from 'react';
import MS1DChart from '../../components/MS1DChart';
import SpatiotemporalChart from '../../components/SpatiotemporalChart';
import Input from '../../components/Input';
import Button from '../../components/Button';
import SimulationWorker from '../../simulation_ms_1d.worker.js?worker';
import './styles.css';

const MitchellSchaeffer1DPage = ({ onBack }) => {
  const [simulationData, setSimulationData] = useState([]);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [worker, setWorker] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [windowSize, setWindowSize] = useState(50);
  const [scrollPosition, setScrollPosition] = useState(0);
  const [viewMode, setViewMode] = useState('line');

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
      }, 10);
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
  
  const handleScrollChange = (e) => {
    setScrollPosition(parseInt(e.target.value, 10));
  };

  const handleZoomChange = (e) => {
    setWindowSize(parseFloat(e.target.value));
  };

  const currentChartData = simulationData[currentFrame]?.data || [];

  return (
    <div className="page-container">
      <Button onClick={onBack}>Voltar para Home</Button>
      <h1>Modelo Mitchell-Schaeffer 1D</h1>

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
      
      {viewMode === 'line' && (
        <div className="controls-container">
          <div className="zoom-control">
            <label>Zoom (Largura da Janela)</label>
            <input
              type="number"
              value={windowSize}
              onChange={handleZoomChange}
              min={10}
              max={editableParams.L}
            />
          </div>
          {simulationData.length > 0 && (
            <div className="scroll-control">
              <label>Navegar no Gráfico</label>
              <input
                type="range"
                min="0"
                max={editableParams.L - windowSize}
                value={scrollPosition}
                onChange={handleScrollChange}
                className="scroll-slider"
              />
            </div>
          )}
        </div>
      )}

      {viewMode === 'line' ? (
        <MS1DChart 
          data={currentChartData} 
          windowSize={windowSize} 
          scrollPosition={scrollPosition} 
        />
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

export default MitchellSchaeffer1DPage;