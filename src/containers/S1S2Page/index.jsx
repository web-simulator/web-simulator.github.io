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

  /*
  // Parâmetros que o usuário pode ajustar (VERSÃO ANTIGA)
  const [s1s2Params, setS1s2Params] = useState({
    BCL_S1: 250, // BCL do S1
    intervalo_S2: 180, // Intervalo do S2
  });

  // Parâmetros do modelo que o usuário pode modificar (VERSÃO ANTIGA)
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

  // Parâmetros fixos (VERSÃO ANTIGA)
  const [fixedParams] = useState({
    dt: 0.01,                // Passo de tempo
    v_inicial: 0.0,          // Condição inicial da voltagem
    h_inicial: 1.0,          // Condição inicial da variável de gate h
    num_estimulos_s1: 8,     // Número de estímulos S1
    downsamplingFactor: 100
  });
  */

  // Estado unificado com todos os parâmetros editáveis
  const [editableParams, setEditableParams] = useState({
    BCL_S1: 250,
    intervalo_S2: 180,
    despolarização: 0.3,
    repolarização: 6.0,
    recuperação: 120.0,
    inativação: 80.0,
    gate: 0.13,
    inicio: 5.0,
    duração: 1.0,
    amplitude: 1.0,
    dt: 0.01,
    v_inicial: 0.0,
    h_inicial: 1.0,
    num_estimulos_s1: 8,
    downsamplingFactor: 100,
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

  /*
  // Função para lidar com mudanças nos inputs (VERSÃO ANTIGA)
  const handleChange = useCallback((e, name, type) => {
    const value = parseFloat(e.target.value);
    if (type === 's1s2') {
      setS1s2Params((prev) => ({ ...prev, [name]: value }));
    } else {
      setModelParams((prev) => ({ ...prev, [name]: value }));
    }
  }, []);
  */

  // Função única para atualizar qualquer parâmetro (VERSÃO ATUAL)
  const handleChange = useCallback((e, name) => {
    setEditableParams((prevParams) => ({
      ...prevParams,
      [name]: parseFloat(e.target.value)
    }));
  }, []);

  /*
  // Função para iniciar a simulação (VERSÃO ANTIGA)
  const handleSimularClick = useCallback(() => {
    if (worker) {
      setLoading(true);
      const allParams = { ...s1s2Params, ...modelParams, ...fixedParams };
      worker.postMessage(allParams);
    }
  }, [worker, s1s2Params, modelParams, fixedParams]);
  */

  // Envia o estado unificado para o worker
  const handleSimularClick = useCallback(() => {
    if (worker) {
      setLoading(true);
      worker.postMessage(editableParams);
    }
  }, [worker, editableParams]);

  return (
    <div className="page-container">
      <Button onClick={onBack}>Voltar para Home</Button>
      <h1>Modelo Mitchell-Schaeffer - Protocolo S1-S2</h1>
      
      {/* Inputs */}
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

      <Button onClick={handleSimularClick} disabled={loading}>
        {loading ? 'Simulando...' : 'Simular S1-S2'}
      </Button>

      <Chart data={data} />
    </div>
  );
};

export default S1S2Page;