import { useState, useEffect, useCallback } from 'react';
import Chart from '../../components/Chart';
import Input from '../../components/Input';
import Button from '../../components/Button';
import Modal from '../../components/Modal';
import RestitutionChart from '../../components/RestitutionChart';
import SimulationWorker from '../../simulation_mms_restitution.worker.js?worker';
import './styles.css';

const MMSCurvePage = ({ onBack }) => {
  const [data, setData] = useState([]); // Dados Gráfico principal
  const [restitutionData, setRestitutionData] = useState([]); // Dados urva de restituição
  const [worker, setWorker] = useState(null); 
  const [loading, setLoading] = useState(false);// "carregando" 
  const [isModalOpen, setIsModalOpen] = useState(false); // Visibilidade do modal

  // Parâmetros da simulação que o usuário pode alterar
  const [simParams, setSimParams] = useState({
    num_ciclos: 200,
    BCL_S1: 250,
    intervalo_S2_inicial: 200,
    decremento_S2: 1,
  });

  // Parâmetros do modelo que o usuário pode alterar
  const [modelParams, setModelParams] = useState({
    tau_in: 0.1,
    tau_out: 9.0,
    tau_open: 100.0,
    tau_close: 120.0,
    v_gate: 0.13,
    inicio: 5.0,
    duracao: 1.0,
    amplitude: 1.0,
  });

  // Parâmetros fixos
  const [fixedParams] = useState({
    dt: 0.1,
    v_inicial: 0.0,
    h_inicial: 1.0,
    num_estimulos_s1: 8,
    downsamplingFactor: 3000,
  });

  useEffect(() => {
    const simulationWorker = new SimulationWorker();
    setWorker(simulationWorker);

    // Define a função que será executada quando o worker for ativo
    simulationWorker.onmessage = (e) => {
      const { timeSeriesData, restitutionData } = e.data;
      setData(timeSeriesData); // Atualiza os dados do gráfico principal
      setRestitutionData(restitutionData); // Atualiza os dados da curva de restituição
      setLoading(false); // Finaliza "carregando"
    };

    // Encerra o worker quando o componente é fechado
    return () => {
      simulationWorker.terminate();
    };
  }, []); // Garante seja executado apenas uma vez

  // Lida com a alteração dos valores dos inputs
  const handleChange = useCallback((e, name) => {
    const value = parseFloat(e.target.value);
    setSimParams((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleModelChange = useCallback((e, name) => {
    const value = parseFloat(e.target.value);
    setModelParams((prev) => ({ ...prev, [name]: value }));
  }, []);

  // Iniciar a simulação
  const handleSimularClick = useCallback(() => {
    if (worker) {
      setLoading(true); // Ativa "carregando".
      setData([]); // Limpa os dados de simulações anteriores
      setRestitutionData([]);
      // Combina todos os parâmetros em um único objeto.
      const allParams = { ...simParams, ...modelParams, ...fixedParams };
      // Envia os parâmetros para o worker
      worker.postMessage(allParams);
    }
  }, [worker, simParams, modelParams, fixedParams]); // Dependências da função.

  // Organização da página
  return (
    <div className="page-container">
      <Button onClick={onBack}>Voltar para Home</Button>
      <h1>Curva de Restituição (Mitchell-Schaeffer Modificado)</h1>

      {/* Seção para os parâmetros da simulação */}
      <h2>Parâmetros da Simulação</h2>
      <div className="params-container">
        {Object.keys(simParams).map((key) => (
          <Input
            key={key}
            label={key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ')}
            value={simParams[key]}
            onChange={(e) => handleChange(e, key)}
          />
        ))}
      </div>

      {/* Seção para os parâmetros do modelo */}
      <h2>Parâmetros do Modelo</h2>
      <div className="params-container">
        {Object.keys(modelParams).map((key) => (
          <Input
            key={key}
            label={key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ')}
            value={modelParams[key]}
            onChange={(e) => handleModelChange(e, key)}
          />
        ))}
      </div>

      {/* Botões de ação */}
      <div className="button-container">
        <Button onClick={handleSimularClick} disabled={loading}>
          {loading ? 'Simulando...' : 'Simular'}
        </Button>
        <Button onClick={() => setIsModalOpen(true)} disabled={restitutionData.length === 0}>
          Características da Simulação
        </Button>
      </div>

      {/* Gráfico principal*/}
      <Chart data={data} />

      {/* Modal para exibir a curva de restituição */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
        <h2>Curva de Restituição</h2>
        <RestitutionChart data={restitutionData} />
      </Modal>
    </div>
  );
};

export default MMSCurvePage;