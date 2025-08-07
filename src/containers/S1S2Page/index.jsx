import { useState, useEffect, useCallback } from 'react';
import Chart from '../../components/Chart';
import Input from '../../components/Input';
import Button from '../../components/Button';
import SimulationWorker from '../../simulation_s1_s2.worker.js?worker';
import './styles.css';

const S1S2Page = ({ onBack }) => {
  const [data, setData] = useState([]); // Armazena os dados retornados pelo worker
  const [worker, setWorker] = useState(null); 
  const [loading, setLoading] = useState(false); // Simulação em andamento?

  // Parâmetros que o usuário pode ajustar
  const [s1s2Params, setS1s2Params] = useState({
    BCL_S1: 250, // BCL do S1
    intervalo_S2: 180, // Intervalo do S2
  });

  // Parâmetros do modelo que o usuário pode modificar
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
    dt: 0.01,                // Passo de tempo
    v_inicial: 0.0,          // Condição inicial da voltagem
    h_inicial: 1.0,          // Condição inicial da variável de gate h
    num_estimulos_s1: 8,     // Número de estímulos S1
    downsamplingFactor: 200, // Fator para reduzir o número de pontos no gráfico otimização
  });

  useEffect(() => {
    const simulationWorker = new SimulationWorker();
    setWorker(simulationWorker);

    simulationWorker.onmessage = (e) => {
      setData(e.data); // Resultados da simulação.
      setLoading(false); // Desativa "carregando".
    };

    return () => {
      simulationWorker.terminate(); // Encerra o worker para liberar recursos.
    };
  }, []); // Garante que o efeito rode apenas uma vez

  // Função para lidar com mudanças nos inputs
  const handleChange = useCallback((e, name, type) => {
    const value = parseFloat(e.target.value);
    if (type === 's1s2') {
      setS1s2Params((prev) => ({ ...prev, [name]: value }));
    } else {
      setModelParams((prev) => ({ ...prev, [name]: value }));
    }
  }, []);

  // Função para iniciar a simulação
  const handleSimularClick = useCallback(() => {
    if (worker) {
      setLoading(true); // Ativa o indicador de carregamento
      // Junta todos os objetos de parâmetros em um só
      const allParams = { ...s1s2Params, ...modelParams, ...fixedParams };
      // Envia os parâmetros para o worker iniciar os cálculos
      worker.postMessage(allParams);
    }
  }, [worker, s1s2Params, modelParams, fixedParams]);

  // Organização da página
  return (
    <div className="page-container">
      <Button onClick={onBack}>Voltar para Home</Button>
      <h1>Modelo Mitchell-Schaeffer - Protocolo S1-S2</h1>

      {/* Seção de inputs para os parâmetros do protocolo S1-S2 */}
      <h2>Parâmetros do Protocolo S1-S2</h2>
      <div className="params-container">
        {Object.keys(s1s2Params).map((key) => (
          <Input
            key={key}
            label={key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ')}
            value={s1s2Params[key]}
            onChange={(e) => handleChange(e, key, 's1s2')}
          />
        ))}
      </div>

      {/* Seção de inputs para os parâmetros do modelo celular */}
      <h2>Parâmetros do Modelo</h2>
      <div className="params-container">
        {Object.keys(modelParams).map((key) => (
          <Input
            key={key}
            label={key.charAt(0).toUpperCase() + key.slice(1)}
            value={modelParams[key]}
            onChange={(e) => handleChange(e, key, 'model')}
          />
        ))}
      </div>

      {/* Botão de simulação, desabilitado durante o carregamento */}
      <Button onClick={handleSimularClick} disabled={loading}>
        {loading ? 'Simulando...' : 'Simular S1-S2'}
      </Button>

      {/* Componente de gráfico para exibir os dados da simulação */}
      <Chart data={data} />
    </div>
  );
};

export default S1S2Page;