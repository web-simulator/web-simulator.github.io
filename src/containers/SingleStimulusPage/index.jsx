import { useState, useEffect, useCallback } from 'react';
import Chart from '../../components/Chart';
import Input from '../../components/Input';
import Button from '../../components/Button';
import Modal from '../../components/Modal';
import SimulationWorker from '../../simulation.worker.js?worker';
import './styles.css';

const SingleStimulusPage = ({ onBack }) => {
  // Armazena os dados retornados pela simulação
  const [data, setData] = useState([]);
  
  // Armazena o worker
  const [worker, setWorker] = useState(null);
  
  // Indica quando a simulação está sendo executada
  const [loading, setLoading] = useState(false);

  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);

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

      {/* Botão e Modal de Informações */}
      <div style={{ marginTop: '20px' }}>
        <Button onClick={() => setIsInfoModalOpen(true)}>
          Saiba mais sobre essa simulação
        </Button>
      </div>

      <Modal isOpen={isInfoModalOpen} onClose={() => setIsInfoModalOpen(false)}>
        <div className="info-modal-content">
          <h2>Modelo Mitchell-Schaeffer</h2>
          
          <h3>Modelo Matemático</h3>
          <p>
            Esta simulação usa o modelo Mitchell-Schaeffer para descrever o potencial de ação cardíaco. 
            É um modelo de duas variáveis, o que significa que simula o comportamento de uma única célula.
          </p>
          <p>As equações são:</p>
          <ul>
            <li><code>dv/dt = (h * v² * (1 - v)) / τ_in - v / τ_out + I_stim</code></li>
            <li><code>dh/dt = (1 - h) / τ_open</code> (se <code>v &lt; v_gate</code>)</li>
            <li><code>dh/dt = -h / τ_close</code> (se <code>v ≥ v_gate</code>)</li>
          </ul>
          
          <h3>Método Numérico</h3>
          <p>
            As equações são resolvidas numericamente usando o método Runge-Kutta de 4ª Ordem.
          </p>

          <h3>Significado dos Parâmetros</h3>
          <ul>
            <li>Despolarização (τ_in): Controla a velocidade da fase de ascensão  do potencial de ação. Um valor menor torna a subida mais rápida.</li>
            <li>Repolarização (τ_out): Controla a velocidade da fase de repolarização. Um valor menor torna a descida mais rápida.</li>
            <li>Recuperação (τ_open): Controla o tempo que a célula leva para se tornar excitável novamente.</li>
            <li>Inativação (τ_close): Controla a rapidez com que a célula se torna refratária durante o potencial de ação.</li>
            <li>Gate (v_gate): O limiar de voltagem que alterna o comportamento da variável <code>h</code> entre recuperação e inativação.</li>
            <li>Inicio: O tempo (em ms) em que o estímulo é aplicado.</li>
            <li>Duração: A duração (em ms) do pulso de estímulo.</li>
            <li>Amplitude: A intensidade do estímulo (<code>I_stim</code>).</li>
            <li>Dt: O passo de tempo da simulação numérica.</li>
            <li>Tempo Total: A duração total da simulação.</li>
          </ul>
        </div>
      </Modal>
    </div>
  );
};

export default SingleStimulusPage;