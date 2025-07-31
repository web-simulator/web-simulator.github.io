
import { useState, useCallback } from 'react';

import Chart from '../../components/Chart';
import Input from '../../components/Input';
import Button from '../../components/Button';
import SimulationWorker from '../../simulation_bcl_series.worker.js?worker'; // utilizada para que a simulação ocorra em segundo plano

// Importa os estilos CSS para este componente.
import './styles.css';

const BCLSeriesPage = ({ onBack }) => {
  const [simulationResults, setSimulationResults] = useState([]); // armazena os resultados das simulações
  
  const [loading, setLoading] = useState(false); // indica se a simulção está em andamento

  // Parâmetros da simulação
  const [simParams, setSimParams] = useState({
    numero_simulacoes: 3,    // número de simualções 
    BCL_inicial: 250,        // Valor inicial do BCL
    decremento_BCL: 20,      // O valor a ser subtraído do BCL
  });

  // Parâmetros do modelo
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

  // Parâmetros não editáveis pelo usuário
  const [fixedParams] = useState({
    dt: 0.01,                 // Passo de tempo para a integração numérica
    v_inicial: 0.0,           // Potencial de membrana inicial
    h_inicial: 1.0,           // Gate inicial
    num_estimulos: 8,         // Número de estímulos por simulação
    downsamplingFactor: 50, // Fator para reduzir o número de pontos no gráfico
  });

  // Função para lidar com a mudança nos campos de input
  const handleChange = useCallback((e, name, type) => {
    const value = parseFloat(e.target.value); // Converte o valor do input para número.
    if (type === 'sim') { // Atualiza os parâmetros da simulação
      setSimParams((prev) => ({ ...prev, [name]: value }));
    } else { // Atualiza os parâmetros do modelo
      
      setModelParams((prev) => ({ ...prev, [name]: value }));
    }
  }, []);

  // Função principal que é chamada ao clicar no botão Simular Série
  const handleSimularClick = useCallback(() => {
    setLoading(true); // Ativa o estado de carregamento
    setSimulationResults([]); // Limpa os resultados anteriores

    // Cria um array com todos os valores de BCL que serão simulados
    const bcls = Array.from(
      { length: simParams.numero_simulacoes },
      (_, i) => simParams.BCL_inicial - i * simParams.decremento_BCL
    );

    // Mapeia cada valor de BCL para uma Promise que executará a simulação em um Web Worker
    const promises = bcls.map(bcl => {
      return new Promise((resolve, reject) => {
        // Cria uma nova instância do Worker para cada simulação
        const worker = new SimulationWorker();
        
        // Define o que fazer com os resultados recebidos
        worker.onmessage = (e) => {
          resolve(e.data); // Resolve a Promise com os dados recebidos
          worker.terminate(); // Encerra o worker para liberar recursos
        };
        
        // Caso aja algum erro
        worker.onerror = (err) => {
            reject(err); // Rejeita a Promise com o erro
            worker.terminate(); // Encerra o worker
        }
        
        // Envia os parâmetros para o worker para que ele inicie a simulação
        worker.postMessage({
          ...modelParams,
          ...fixedParams,
          BCL: bcl, // Inclui o BCL específico para esta simulação.
        });
      });
    });

    // Aguarda a resolução de todas as Promises
    Promise.all(promises)
      .then(results => {
        // Ordena os resultados pelo BCL em ordem decrescente
        results.sort((a, b) => b.bcl - a.bcl);
        setSimulationResults(results); // Atualiza com resultados ordenados
      })
      .catch(console.error) // Debug para erros
      .finally(() => {
        setLoading(false); // Desativa o estado de carregamento
      });
  }, [simParams, modelParams, fixedParams]); // Dependências

  // Estrutura da página
  return (
    <div className="page-container">
      <Button onClick={onBack}>Voltar para Home</Button>
      <h1>Modelo Mitchell-Schaeffer - Série de Simulações com BCL Decrescente</h1>
      
      <h2>Parâmetros da Simulação</h2>
      {/* Inputs dos parâmetros da simulação*/}
      <div className="params-container">
        {/* Cria um componente Input para cada parâmetro*/}
        {Object.keys(simParams).map((key) => (
          <Input
            key={key}
            label={key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ')}
            value={simParams[key]}
            onChange={(e) => handleChange(e, key, 'sim')}
          />
        ))}
      </div>

      <h2>Parâmetros do Modelo</h2>
      {/*Inputs dos parâmetros do modelo*/}
      <div className="params-container">
        {/*Cria um componente Input para cada parâmetro*/}
        {Object.keys(modelParams).map((key) => (
          <Input
            key={key}
            label={key.charAt(0).toUpperCase() + key.slice(1)}
            value={modelParams[key]}
            onChange={(e) => handleChange(e, key, 'model')}
          />
        ))}
      </div>

      {/* Botão para iniciar a simulação*/}
      <Button onClick={handleSimularClick} disabled={loading}>
        {loading ? 'Simulando...' : 'Simular Série'}
      </Button>

      {/* Grade de gráficos. */}
      <div className="charts-grid-container">
        {/*Para cada resultado, renderiza um gráfico*/}
        {simulationResults.map(result => (
          <div key={result.bcl} className="chart-container">
            <h3>BCL = {result.bcl} ms</h3>
            <Chart data={result.data} />
          </div>
        ))}
      </div>
    </div>
  );
};

export default BCLSeriesPage;