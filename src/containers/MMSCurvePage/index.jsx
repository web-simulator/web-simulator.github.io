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
  const [restitutionData, setRestitutionData] = useState([]); // Dados curva de restituição
  const [worker, setWorker] = useState(null); 
  const [loading, setLoading] = useState(false);// "carregando" 
  const [isModalOpen, setIsModalOpen] = useState(false); // Visibilidade do modal

  // Parâmetros da simulação que o usuário pode alterar
  const [simParams, setSimParams] = useState({
  BCL_S1: 250,
  BCL_S2_inicial: 200,
  BCL_S2_final: 100, 
  delta_CL: 1, 
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
      setLoading(true);
      setData([]);
      setRestitutionData([]);

      // Calcular o fator de dowsampling para otimizar o gráfico
      const num_ciclos = Math.floor((simParams.BCL_S2_inicial - simParams.BCL_S2_final) / simParams.delta_CL) + 1; // Número de ciclos S2
      const avg_BCL_S2 = (simParams.BCL_S2_inicial + simParams.BCL_S2_final) / 2; // BCL médio dos estímulos S2
      const duration_per_cycle = modelParams.inicio + (fixedParams.num_estimulos_s1 - 1) * simParams.BCL_S1 + avg_BCL_S2 + 1.5 * simParams.BCL_S1; // Duração aproximada de cada ciclo completo
      const total_duration = num_ciclos * duration_per_cycle; // Duração total da simulação
      const total_steps = total_duration / fixedParams.dt; // Número total de passos na simulação
      const target_points = 5000; // Número alvo de pontos para o gráfico
      const dynamicDownsamplingFactor = Math.max(1, Math.ceil(total_steps / target_points)); // Definição do fator
      
      const allParams = { ...simParams, ...modelParams, ...fixedParams, downsamplingFactor: dynamicDownsamplingFactor };
      worker.postMessage(allParams);
    }
  }, [worker, simParams, modelParams, fixedParams]);

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
          Curva de Restituição
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