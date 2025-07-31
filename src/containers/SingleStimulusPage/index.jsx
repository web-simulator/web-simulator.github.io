import { useState, useEffect, useCallback } from 'react';
import Chart from '../../components/Chart';
import Input from '../../components/Input';
import Button from '../../components/Button';
import SimulationWorker from '../../simulation.worker.js?worker';
import './styles.css';

const SingleStimulusPage = ({ onBack }) => {
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
  });

  const [fixedParams] = useState({
    dt: 0.01,
    tempo_total: 500.0,
    v_inicial: 0.0,
    h_inicial: 1.0,
    downsamplingFactor: 50, // Renderiza 1 a cada 50 pontos. (50.000 / 50 = 1000 pontos no gráfico)
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
    // Adicione um wrapper e o botão de voltar
    <div className="page-container">
      <Button onClick={onBack}>Voltar para Home</Button>
      <h1>Modelo de Mitchell-Schaeffer (1 Estímulo)</h1>
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

export default SingleStimulusPage;