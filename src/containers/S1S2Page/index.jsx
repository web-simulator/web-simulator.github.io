import { useState, useEffect, useCallback } from 'react';
import Chart from '../../components/Chart';
import Input from '../../components/Input';
import Button from '../../components/Button';
import SimulationWorker from '../../simulation_s1_s2.worker.js?worker';
import './styles.css';

const S1S2Page = ({ onBack }) => {
  const [data, setData] = useState([]);
  const [worker, setWorker] = useState(null);
  const [loading, setLoading] = useState(false);

  // Parâmetros para o protocolo S1-S2
  const [s1s2Params, setS1s2Params] = useState({
    BCL_S1: 250,
    intervalo_S2: 180,
  });

  const [modelParams, setModelParams] = useState({
    despolarização: 0.3,
    repolarização: 6.0,
    recuperação: 120.0,
    inativação: 80.0,
    gate: 0.13,
    inicio: 5.0,
    duração: 1.0,
    amplitude: 1.0,
  });

  const [fixedParams] = useState({
    dt: 0.01,
    v_inicial: 0.0,
    h_inicial: 1.0,
    num_estimulos_s1: 8,
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

  const handleChange = useCallback((e, name, type) => {
    const value = parseFloat(e.target.value);
    if (type === 's1s2') {
      setS1s2Params((prev) => ({ ...prev, [name]: value }));
    } else {
      setModelParams((prev) => ({ ...prev, [name]: value }));
    }
  }, []);

  const handleSimularClick = useCallback(() => {
    if (worker) {
      setLoading(true);
      const allParams = { ...s1s2Params, ...modelParams, ...fixedParams };
      worker.postMessage(allParams);
    }
  }, [worker, s1s2Params, modelParams, fixedParams]);

  return (
    <div className="page-container">
      <Button onClick={onBack}>Voltar para Home</Button>
      <h1>Modelo Mitchell-Schaeffer - Protocolo S1-S2</h1>

      <h2>Parâmetros do Protocolo S1-S2</h2>
      <div className="params-container">
        {Object.keys(s1s2Params).map((key) => (
          <Input
            key={key}
            label={key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ')}
            value={s1s2Params[key]}
            onChange={(e) => handleChange(e, key, 's1s2')}
          />
        ))}
      </div>

      <h2>Parâmetros do Modelo</h2>
      <div className="params-container">
        {Object.keys(modelParams).map((key) => (
          <Input
            key={key}
            label={key.charAt(0).toUpperCase() + key.slice(1)}
            value={modelParams[key]}
            onChange={(e) => handleChange(e, key, 'model')}
          />
        ))}
      </div>

      <Button onClick={handleSimularClick} disabled={loading}>
        {loading ? 'Simulando...' : 'Simular S1-S2'}
      </Button>

      <Chart data={data} />
    </div>
  );
};

export default S1S2Page;