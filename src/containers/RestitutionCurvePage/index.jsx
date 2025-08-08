import { useState, useEffect, useCallback } from 'react';
import Chart from '../../components/Chart';
import Input from '../../components/Input';
import Button from '../../components/Button';
import Modal from '../../components/Modal';
import RestitutionChart from '../../components/RestitutionChart';
import SimulationWorker from '../../simulation_restitution.worker.js?worker';
import './styles.css';

const RestitutionCurvePage = ({ onBack }) => {
  const [data, setData] = useState([]); // Dados gráfico principal
  const [restitutionData, setRestitutionData] = useState([]);// Curva de restituição
  const [worker, setWorker] = useState(null); 
  const [loading, setLoading] = useState(false); // "carregando"
  const [isModalOpen, setIsModalOpen] = useState(false); // Abertura e fechamento do modal

  // Parâmetros da simulação que o usuário pode alterar
  const [simParams, setSimParams] = useState({
    num_ciclos: 10,
    BCL_S1: 250,
    intervalo_S2_inicial: 200,
    decremento_S2: 10,
  });

  // Parâmetros do modelo que o usuário pode alterar
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

  // Parâmetros fixos
  const [fixedParams] = useState({
    dt: 0.1,
    v_inicial: 0.0,
    h_inicial: 1.0,
    num_estimulos_s1: 8,
    downsamplingFactor: 20,
  });

  useEffect(() => {
    // Cria uma nova instância do worker da simulação
    const simulationWorker = new SimulationWorker();
    setWorker(simulationWorker);

    // Define o que fazer quando o worker envia uma mensagem
    simulationWorker.onmessage = (e) => {
      const { timeSeriesData, restitutionData } = e.data;
      setData(timeSeriesData); // Atualiza os dados do gráfico principal
      setRestitutionData(restitutionData); // Atualiza os dados da curva de restituição
      setLoading(false); // Finaliza o estado de "carregando"
    };

    // Encerra o worker quando o componente é desmontado.
    return () => {
      simulationWorker.terminate();
    };
  }, []);

  // Mudanças nos parâmetros da simulação
  const handleChange = useCallback((e, name) => {
    const value = parseFloat(e.target.value);
    setSimParams((prev) => ({ ...prev, [name]: value }));
  }, []);

  // Mudanças nos parâmetros do modelo
  const handleModelChange = useCallback((e, name) => {
    const value = parseFloat(e.target.value);
    setModelParams((prev) => ({ ...prev, [name]: value }));
  }, []);

  // Função chamada ao clicar no botão Simular
  const handleSimularClick = useCallback(() => {
    if (worker) {
      setLoading(true); // Inicia o carregamento
      setData([]); // Limpa os dados antigos
      setRestitutionData([]); // Limpa os dados antigos
      const allParams = { ...simParams, ...modelParams, ...fixedParams }; // Junta todos os parâmetros
      worker.postMessage(allParams); // Envia os parâmetros para o worker iniciar a simulação
    }
  }, [worker, simParams, modelParams, fixedParams]);

  return (
    <div className="page-container">
      {/* Botão para voltar à página inicial. */}
      <Button onClick={onBack}>Voltar para Home</Button>
      <h1>Curva de Restituição</h1>

      {/* Seção de Parâmetros da Simulação */}
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

      {/* Seção de Parâmetros do Modelo */}
      <h2>Parâmetros do Modelo</h2>
      <div className="params-container">
        {Object.keys(modelParams).map((key) => (
          <Input
            key={key}
            label={key.charAt(0).toUpperCase() + key.slice(1)}
            value={modelParams[key]}
            onChange={(e) => handleModelChange(e, key)}
          />
        ))}
      </div>

      {/* Botões*/}
      <div className="button-container">
        <Button onClick={handleSimularClick} disabled={loading}>
          {loading ? 'Simulando...' : 'Simular'}
        </Button>
        <Button onClick={() => setIsModalOpen(true)} disabled={restitutionData.length === 0}>
          Características da Simulação
        </Button>
      </div>

      {/* Exibe o gráfico principal com os dados da simulação */}
      <Chart data={data} />

      {/* Modal que só é exibido se isModalOpen for verdadeiro */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
        <h2>Curva de Restituição</h2>
        {/* Gráfico da curva de restituição dentro do modal */}
        <RestitutionChart data={restitutionData} />
      </Modal>
    </div>
  );
};

export default RestitutionCurvePage;