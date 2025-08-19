import { useState, useEffect, useCallback } from 'react';
import Chart from '../../components/Chart';
import Input from '../../components/Input';
import Button from '../../components/Button';
import SimulationWorker from '../../simulation.worker.js?worker';
import './styles.css';

const SingleStimulusPage = ({ onBack }) => {
  // Armazena os dados retornados pela simulação
  const [data, setData] = useState([]);
  
  // Armazena o worker
  const [worker, setWorker] = useState(null);
  
  // Indica quando a simulação está sendo executada
  const [loading, setLoading] = useState(false);

  // Parâmetros que podem ser editados pelo usuário
  /*const [editableParams, setEditableParams] = useState({
    despolarização: 0.3,
    repolarização: 6.0,
    recuperação: 120.0,
    inativação: 80.0,
    gate: 0.13,
    inicio: 5.0,
    duração: 1.0,
    amplitude: 1.0,
  });

  // Parâmetros fixos da simulação
  const [fixedParams] = useState({
    dt: 0.01,
    tempo_total: 500.0,
    v_inicial: 0.0,
    h_inicial: 1.0,
    downsamplingFactor: 100, // Renderiza 1 ponto a cada 50 calculados para otimização
  });*/

  // Todos os parametros podem ser editados
  const [editableParams, setEditableParams] = useState({
  despolarização: 0.3,
  repolarização: 6.0,
  recuperação: 120.0,
  inativação: 80.0,
  gate: 0.13,
  inicio: 5.0,
  duração: 1.0,
  amplitude: 1.0,
  dt: 0.01,
  tempo_total: 500.0,
  v_inicial: 0.0,
  h_inicial: 1.0,
  downsamplingFactor: 100,
  });

  // Define o que acontece quando o worker envia os resultados
  useEffect(() => {
    const simulationWorker = new SimulationWorker(); 
    setWorker(simulationWorker);

    // Define a função chamada quando o worker envia dados
    simulationWorker.onmessage = (e) => {
      setData(e.data);       // Atualiza os dados do gráfico
      setLoading(false);     // Finaliza o estado de carregamento
    };

    // Quando o componente é encerrado, encerra o worker
    return () => {
      simulationWorker.terminate();
    };
  }, []);

  // Atualiza os parâmetros editáveis quando o usuário altera os campos de entrada
  const handleChange = useCallback((e, name) => {
    setEditableParams((prevParams) => ({ 
      ...prevParams, 
      [name]: parseFloat(e.target.value) 
    }));
  }, []);

  /*// Inicia a simulação ao clicar no botão
  const handleSimularClick = useCallback(() => {
    if (worker) {
      setLoading(true); // Inicia o carregamento
      const allParams = { ...editableParams, ...fixedParams }; // Junta todos os parâmetros
      worker.postMessage(allParams); // Envia os parâmetros para iniciar a simulação
    }
  }, [worker, editableParams, fixedParams]);*/

  // Para funcionar com todos os parametros editaveis
  const handleSimularClick = useCallback(() => {
  if (worker) {
    setLoading(true);
    worker.postMessage(editableParams); // Envia diretamente o estado editável
  }
}, [worker, editableParams]);

  return (
    <div className="page-container">
      {/* Botão para voltar a página inicial */}
      <Button onClick={onBack}>Voltar para Home</Button>

      {/* Título da página */}
      <h1>Modelo de Mitchell-Schaeffer (1 Estímulo)</h1>

      {/* Campos de entrada dos parâmetros */}
      <div className="params-container">
        {Object.keys(editableParams).map((key) => (
          <Input
            key={key}
            label={key.charAt(0).toUpperCase() + key.slice(1)} // Formata a label
            value={editableParams[key]}
            onChange={(e) => handleChange(e, key)}
          />
        ))}
      </div>

      {/* Botão para iniciar a simulação */}
      <Button onClick={handleSimularClick} disabled={loading}>
        {loading ? 'Simulando...' : 'Simular'}
      </Button>

      {/* Exibe o gráfico com os resultados */}
      <Chart data={data} />
    </div>
  );
};

export default SingleStimulusPage;
