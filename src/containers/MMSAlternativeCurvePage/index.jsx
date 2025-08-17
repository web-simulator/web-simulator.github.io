import { useState, useEffect, useCallback } from 'react';
import RestitutionChart from '../../components/RestitutionChart';
import Input from '../../components/Input';
import Button from '../../components/Button';
import SimulationWorker from '../../simulation_mms_restitution_alt.worker.js?worker';
import './styles.css';

// Define o componente da página
const MMSAlternativeCurvePage = ({ onBack }) => {

  const [restitutionData, setRestitutionData] = useState([]); // Armazena os pontos (DI, APD) retornados pela simulação do worker

  const [analyticalData, setAnalyticalData] = useState([]); // Armazena os pontos da curva analítica/teórica
  const [worker, setWorker] = useState(null); // Armazena o worker

  const [loading, setLoading] = useState(false); // indica se a simulação está em andamento

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
    downsamplingFactor: 3000,
  });

  // Função para calcular a curva analítica
  const calculateAnalyticalCurve = useCallback((simulatedData) => {
    // Se não houver dados simulados como base, limpa os dados analíticos e encerra
    if (!simulatedData || simulatedData.length === 0) {
      setAnalyticalData([]);
      return;
    }

    const { tau_out, tau_in, v_gate, tau_close, tau_open } = modelParams; // parametros necessários para o cálculo

    const h_mms_min = Math.pow(1 + (tau_out / (4 * tau_in)) * Math.pow(1 - v_gate, 2), -1); // Calcula a constante h_mms_min com base nos parâmetros

    // Usa a função 'map' para criar um array de pontos analíticos.
    // Para cada ponto simulado, ele calcula um ponto analítico com o mesmo valor de DI.
    const analyticalPoints = simulatedData.map(point => {
      const di = point.bcl; // Armazena o valor do DI.
    
      const analyticalApd = tau_close * Math.log((1 - (1 - h_mms_min) * Math.exp(-di / tau_open)) / h_mms_min); // Fórmula do APD analítico
      
      // Retorna somente se o APD for válido (Maior que 0)
      if (analyticalApd && analyticalApd > 0 ) {
        return { bcl: di, apd: analyticalApd };
      }
      return null;
    }).filter(Boolean); // Remove valores nulos

    // Atualiza com os novos pontos calculados
    setAnalyticalData(analyticalPoints);
  }, [modelParams]);


  useEffect(() => {
    // Cria uma nova instância do Web Worker
    const simulationWorker = new SimulationWorker();
    setWorker(simulationWorker); // Armazena a instância no estado

    // Define o que acontece quando a simulação termina
    simulationWorker.onmessage = (e) => {
      const { restitutionData } = e.data; // Extrai os dados da curva de restituição
      setRestitutionData(restitutionData); // Atualiza com os dados simulados
      
      // Passa os dados simulados para a função que calcula a curva analítica
      calculateAnalyticalCurve(restitutionData);
      
      setLoading(false); // Finaliza o estado de "carregando"
    };

    // Função de limpeza
    return () => {
      simulationWorker.terminate(); // Encerra o worker para liberar recursos do navegador.
    };
  }, [calculateAnalyticalCurve]); 

  // Atualiza os parâmetros da simulação
  const handleChange = useCallback((e, name) => {
    const value = parseFloat(e.target.value);
    setSimParams((prev) => ({ ...prev, [name]: value }));
  }, []);

  // Atualiza os parâmetros do modelo
  const handleModelChange = useCallback((e, name) => {
    const value = parseFloat(e.target.value);
    setModelParams((prev) => ({ ...prev, [name]: value }));
  }, []);

  // Função chamada ao clicar no botão Simular
  const handleSimularClick = useCallback(() => {
    if (worker) { // Verifica se o worker já foi inicializado
      setLoading(true); // Ativa o estado de "carregando"
      setRestitutionData([]); // Limpa os dados de simulações anteriores
      setAnalyticalData([]);
      
      const allParams = { ...simParams, ...modelParams, ...fixedParams }; // Junta todos os objetos de parâmetros em um único objeto
      
      worker.postMessage(allParams); // Envia os parâmetros para o worker iniciar a simulação
    }
  }, [worker, simParams, modelParams, fixedParams]);

  // Estrutura da página
  return (
    <div className="page-container">
      <Button onClick={onBack}>Voltar para Home</Button>
      <h1>Curva de Restituição (MMS) - Gráfico Direto</h1>

      <h2>Parâmetros da Simulação</h2>
      <div className="params-container">
        {/* Inputs da simulação */}
        {Object.keys(simParams).map((key) => (
          <Input
            key={key}
            label={key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ')} // Formata o nome da chave para exibição
            value={simParams[key]}
            onChange={(e) => handleChange(e, key)}
          />
        ))}
      </div>

      <h2>Parâmetros do Modelo</h2>
      <div className="params-container">
        {/* Inputs do modelo */}
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
        <Button onClick={handleSimularClick} disabled={loading}>
          {/* Botão muda enquanto a simulação estiver rodando */}
          {loading ? 'Simulando...' : 'Simular'}
        </Button>
      </div>

      {/* Gráfico */}
      <RestitutionChart data={restitutionData} analyticalData={analyticalData} />
    </div>
  );
};

// Exporta o componente
export default MMSAlternativeCurvePage;