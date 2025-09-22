import { useState, useEffect, useCallback } from 'react';
import Chart from '../../components/Chart';
import Input from '../../components/Input';
import Button from '../../components/Button';
import RestitutionChart from '../../components/RestitutionChart';
import SimulationWorker from '../../simulation_dynamic_protocol1.worker.js?worker';
import './styles.css';

const DynamicProtocolPage = ({ onBack }) => {
  const [data, setData] = useState([]);
  const [restitutionData, setRestitutionData] = useState([]);
  const [worker, setWorker] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showTimeSeries, setShowTimeSeries] = useState(false); // Novo estado

  const [editableParams, setEditableParams] = useState({
    CI1: 500,
    CI0: 250,
    CIinc: 10,
    nbeats: 5,
    despolarização: 0.3,
    repolarização: 6.0,
    recuperação: 120.0,
    inativação: 80.0,
    gate: 0.13,
    inicio: 5.0,
    duração: 1.0,
    amplitude: 1.0,
    dt: 0.1,
    v_inicial: 0.0,
    h_inicial: 1.0,
    downsamplingFactor: 50,
  });

  useEffect(() => {
    const simulationWorker = new SimulationWorker();
    setWorker(simulationWorker);

    simulationWorker.onmessage = (e) => {
      const { timeSeriesData, restitutionData } = e.data;
      setData(timeSeriesData);
      setRestitutionData(restitutionData);
      setLoading(false);
    };

    return () => {
      simulationWorker.terminate();
    };
  }, []);

  const handleChange = useCallback((e, name) => {
    const value = parseFloat(e.target.value);
    setEditableParams((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleSimularClick = useCallback(() => {
    if (worker) {
      setLoading(true);
      setData([]);
      setRestitutionData([]);
      worker.postMessage(editableParams);
    }
  }, [worker, editableParams]);

  return (
    <div className="page-container">
      <Button onClick={onBack}>Voltar para Home</Button>
      <h1>Protocolo Dinâmico</h1>

      <h2>Parâmetros da Simulação</h2>
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
      </div>

      <div className="checkbox-container">
        <input 
          type="checkbox"
          id="showTimeSeries"
          checked={showTimeSeries}
          onChange={() => setShowTimeSeries(!showTimeSeries)}
        />
        <label htmlFor="showTimeSeries">Mostrar Série Temporal</label>
      </div>

      <RestitutionChart data={restitutionData} />

      {showTimeSeries && <Chart data={data} />}
    </div>
  );
};

export default DynamicProtocolPage;