// src/containers/MultipleStimuliPage/index.jsx
import { useState, useEffect, useCallback } from 'react';
import Chart from '../../components/Chart';
import Input from '../../components/Input';
import Button from '../../components/Button';
import './styles.css';
import SimulationWorker from '../../simulation_8_stimuli.worker.js?worker';

const MultipleStimuliPage = ({ onBack }) => {
  const [data, setData] = useState([]);
  const [worker, setWorker] = useState(null);
  const [loading, setLoading] = useState(false);

  const [editableParams, setEditableParams] = useState({
    despolarização: 0.3,
    repolarização: 6.0,
    recuperação: 120.0,
    inativação: 80.0,
    gate: 0.13,
    inicio: 5.0,
    duração: 1.0,
    amplitude: 1.0,
    BCL: 250,
  });

  const [fixedParams] = useState({
    dt: 0.01,
    v_inicial: 0.0,
    h_inicial: 1.0,
    num_estimulos: 8,
    downsamplingFactor: 50,
  });

  useEffect(() => {
    const simulationWorker = new SimulationWorker();
    setWorker(simulationWorker);

    simulationWorker.onmessage = (e) => {
      setData(e.data);
      setLoading(false);
    };

    return () => {
      simulationWorker.terminate();
    };
  }, []);

  const handleChange = useCallback((e, name) => {
    setEditableParams((prevParams) => ({ ...prevParams, [name]: parseFloat(e.target.value) }));
  }, []);

  const handleSimularClick = useCallback(() => {
    if (worker) {
      setLoading(true);
      const allParams = { ...editableParams, ...fixedParams };
      worker.postMessage(allParams);
    }
  }, [worker, editableParams, fixedParams]);

  return (
    <div className="page-container">
      <Button onClick={onBack}>Voltar para Home</Button>
      <h1>Modelo de Mitchell-Schaeffer com 8 Estímulos</h1>
      <div className="params-container">
        {Object.keys(editableParams).map((key) => (
          <Input
            key={key}
            label={key.charAt(0).toUpperCase() + key.slice(1)}
            value={editableParams[key]}
            onChange={(e) => handleChange(e, key)}
          />
        ))}
      </div>
      <Button onClick={handleSimularClick} disabled={loading}>
        {loading ? 'Simulando...' : 'Simular'}
      </Button>
      <Chart data={data} />
    </div>
  );
};

export default MultipleStimuliPage;