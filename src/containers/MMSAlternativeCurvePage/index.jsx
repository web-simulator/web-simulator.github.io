import { useState, useEffect, useCallback } from 'react';
import RestitutionChart from '../../components/RestitutionChart';
import Input from '../../components/Input';
import Button from '../../components/Button';
import SimulationWorker from '../../simulation_mms_restitution.worker.js?worker';
import './styles.css';

const MMSAlternativeCurvePage = ({ onBack }) => {
  const [restitutionData, setRestitutionData] = useState([]); // Pontos da curva de restituição
  const [worker, setWorker] = useState(null);
  const [loading, setLoading] = useState(false);

  // Parâmetros da simulação que o usuário pode modificar
  const [simParams, setSimParams] = useState({
    BCL_S1: 250,
    BCL_S2_inicial: 200,
    BCL_S2_final: 100,
    delta_CL: 1,
  });

  // Parâmetros do modelo que o usuário pode modificar
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
    // Cria uma nova instância do worker
    const simulationWorker = new SimulationWorker();
    setWorker(simulationWorker);

    // Define o que fazer quando o worker enviar uma mensagem
    simulationWorker.onmessage = (e) => {
      const { restitutionData } = e.data;
      setRestitutionData(restitutionData); // Atualiza com os dados do gráfico
      setLoading(false); // Finaliza o carregamento
    };

    // Função de limpeza
    return () => {
      simulationWorker.terminate();
    };
  }, []);

  // Lidar com a mudança dos inputs da simulação
  const handleChange = useCallback((e, name) => {
    const value = parseFloat(e.target.value);
    setSimParams((prev) => ({ ...prev, [name]: value }));
  }, []);

  // Lidar com a mudança dos inputs do modelo
  const handleModelChange = useCallback((e, name) => {
    const value = parseFloat(e.target.value);
    setModelParams((prev) => ({ ...prev, [name]: value }));
  }, []);

  // Função chamada ao clicar no botão "Simular"
  const handleSimularClick = useCallback(() => {
    if (worker) {
      setLoading(true); // "Carregando"
      setRestitutionData([]); // Limpa o gráfico anterior
      // Junta todos os parâmetros
      const allParams = { ...simParams, ...modelParams, ...fixedParams };
      // Envia os parâmetros para o Worker iniciar a simulação
      worker.postMessage(allParams);
    }
  }, [worker, simParams, modelParams, fixedParams]);

  // Estrutura da página
  return (
    <div className="page-container">
      <Button onClick={onBack}>Voltar para Home</Button>
      <h1>Curva de Restituição (MMS) - Gráfico Direto</h1>

      <h2>Parâmetros da Simulação</h2>
      <div className="params-container">
        {/* Inputs dos parâmetros da simulação */}
        {Object.keys(simParams).map((key) => (
          <Input
            key={key}
            label={key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ')}
            value={simParams[key]}
            onChange={(e) => handleChange(e, key)}
          />
        ))}
      </div>

      <h2>Parâmetros do Modelo</h2>
      <div className="params-container">
        {/* Inputs dos parâmetros do modelo */}
        {Object.keys(modelParams).map((key) => (
          <Input
            key={key}
            label={key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ')}
            value={modelParams[key]}
            onChange={(e) => handleModelChange(e, key)}
          />
        ))}
      </div>

      <div className="button-container">
        {/* Desabilitar o botão durante o carregamento */}
        <Button onClick={handleSimularClick} disabled={loading}>
          {loading ? 'Simulando...' : 'Simular'}
        </Button>
      </div>

      {/* Gráfico */}
      <RestitutionChart data={restitutionData} />
    </div>
  );
};

export default MMSAlternativeCurvePage;