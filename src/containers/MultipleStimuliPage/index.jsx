import { useState, useEffect, useCallback } from 'react';
import Chart from '../../components/Chart';
import Input from '../../components/Input';
import Button from '../../components/Button';
import './styles.css';
import SimulationWorker from '../../simulation_8_stimuli.worker.js?worker';

const MultipleStimuliPage = ({ onBack }) => {
  // Armazena os dados da simulação
  const [data, setData] = useState([]);
  
  // Armazena o worker
  const [worker, setWorker] = useState(null);
  
  // Indica se a simulação está em execução
  const [loading, setLoading] = useState(false);

  // Parâmetros que podem ser alterados pelo usuário
  const [editableParams, setEditableParams] = useState({
    despolarização: 0.3,
    repolarização: 6.0,
    recuperação: 120.0,
    inativação: 80.0,
    gate: 0.13,
    inicio: 5.0,
    duração: 1.0,
    amplitude: 1.0,
    BCL: 250,
    num_estimulos: 8,
  });

  // Parâmetros fixos da simulação
  const [fixedParams] = useState({
    dt: 0.01,
    v_inicial: 0.0,
    h_inicial: 1.0,
  });

  // Efeito para criar o worker assim que a página é carregada
  useEffect(() => {
    const simulationWorker = new SimulationWorker();
    setWorker(simulationWorker);

    // Define o que acontece quando o worker envia os resultados
    simulationWorker.onmessage = (e) => {
      setData(e.data);      // Armazena os dados recebidos
      setLoading(false);    // Finaliza o estado de carregamento
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

  // Inicia a simulação ao clicar no botão
  const handleSimularClick = useCallback(() => {
    if (worker) {
      setLoading(true); // Inicia o carregamento

      // Calcular o fator de dowsampling para otimizar o gráfico
      const total_duration = editableParams.inicio + fixedParams.num_estimulos * editableParams.BCL + 50; // Duração da simulação
      const total_steps = total_duration / fixedParams.dt; // Passos da simulação
      const target_points = 2000; // Alvo de pontos para o gráfico
      const dynamicDownsamplingFactor = Math.max(1, Math.ceil(total_steps / target_points)); // Fator

      const allParams = { ...editableParams, ...fixedParams, downsamplingFactor: dynamicDownsamplingFactor };
      worker.postMessage(allParams); // Envia os parâmetros para iniciar a simulação
    }
  }, [worker, editableParams, fixedParams]);

  return (
    <div className="page-container">
      {/* Botão para voltar a página inicial */}
      <Button onClick={onBack}>Voltar para Home</Button>

      {/* Título da página */}
      <h1>Modelo de Mitchell-Schaeffer com 8 Estímulos</h1>

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

export default MultipleStimuliPage;
