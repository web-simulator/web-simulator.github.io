import { useState, useEffect, useCallback } from 'react';
import Chart from '../../components/Chart';
import Input from '../../components/Input';
import Button from '../../components/Button';
import Modal from '../../components/Modal'; 
import SimulationWorker from '../../simulation_s1_s2.worker.js?worker';
import './styles.css';

const S1S2Page = ({ onBack }) => {
  const [data, setData] = useState([]);
  const [worker, setWorker] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);

  // Estado unificado com todos os parâmetros editáveis
  const [editableParams, setEditableParams] = useState({
    BCL_S1: 250,
    intervalo_S2: 180,
    despolarização: 0.3,
    repolarização: 6.0,
    recuperação: 120.0,
    inativação: 80.0,
    gate: 0.13,
    inicio: 5.0,
    duração: 1.0,
    amplitude: 1.0,
    dt: 0.01,
    v_inicial: 0.0,
    h_inicial: 1.0,
    num_estimulos_s1: 8,
    downsamplingFactor: 100,
  });


  useEffect(() => {
    const simulationWorker = new SimulationWorker();
    setWorker(simulationWorker);

    simulationWorker.onmessage = (e) => {
      setData(e.data);
      setLoading(false);
    };

    return () => {
      simulationWorker.terminate();
    };
  }, []);

  // Função única para atualizar qualquer parâmetro (VERSÃO ATUAL)
  const handleChange = useCallback((e, name) => {
    setEditableParams((prevParams) => ({
      ...prevParams,
      [name]: parseFloat(e.target.value)
    }));
  }, []);

  // Envia o estado unificado para o worker
  const handleSimularClick = useCallback(() => {
    if (worker) {
      setLoading(true);
      worker.postMessage(editableParams);
    }
  }, [worker, editableParams]);

  return (
    <div className="page-container">
      <Button onClick={onBack}>Voltar para Home</Button>
      <h1>Modelo Mitchell-Schaeffer - Protocolo S1-S2</h1>
      
      {/* Inputs */}
      <h2>Parâmetros da Simulação</h2>
      <div className="params-container">
        {Object.keys(editableParams).map((key) => (
          <Input
            key={key}
            label={key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ')}
            value={editableParams[key]}
            onChange={(e) => handleChange(e, key)}
          />
        ))}
      </div>

      <Button onClick={handleSimularClick} disabled={loading}>
        {loading ? 'Simulando...' : 'Simular S1-S2'}
      </Button>

      <Chart data={data} />

      {/* Botão e Modal de Informações */}
      <div style={{ marginTop: '20px' }}>
        <Button onClick={() => setIsInfoModalOpen(true)}>
          Saiba mais sobre essa simulação
        </Button>
      </div>

      <Modal isOpen={isInfoModalOpen} onClose={() => setIsInfoModalOpen(false)}>
        <div className="info-modal-content">
          <h2>Protocolo S1-S2</h2>
          
          <h3>Protocolo de Estimulação</h3>
          <p>
            O protocolo S1-S2 é um método padrão em eletrofisiologia para medir o período refratário de uma célula.
          </p>
          <ul>
            <li><strong>S1:</strong> Uma sequência de estímulos (<code>num_estimulos_s1</code>) é aplicada a um intervalo fixo (<code>BCL_S1</code>). Isso leva a célula a um estado estacionário.</li>
            <li><strong>S2:</strong> Um único estímulo prematuro (S2) é aplicado após o último S1, com um atraso definido pelo <code>intervalo_S2</code>.</li>
          </ul>
          <p>
            Ao variar o <code>intervalo_S2</code>, pode-se encontrar o menor intervalo que ainda consegue gerar um potencial de ação, definindo assim o período refratário da célula.
          </p>
          
          <h3>Modelo Matemático</h3>
          <p>O modelo celular é o Mitchell-Schaeffer:</p>
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
            <li>BCL S1: Intervalo BCL dos estímulos S1.</li>
            <li>Intervalo S2: O intervalo em que o estímulo S2 é aplicado após o último S1.</li>
            <li>Num Estimulos S1: Número de pulsos S1 para atingir o estado estacionário.</li>
            <li>Despolarização (τ_in): Controla a velocidade da fase de ascensão do potencial de ação. Um valor menor torna a subida mais rápida.</li>
            <li>Repolarização (τ_out): Controla a velocidade da fase de repolarização. Um valor menor torna a descida mais rápida.</li>
            <li>Recuperação (τ_open): Controla o tempo que a célula leva para se tornar excitável novamente.</li>
            <li>Inativação (τ_close): Controla a rapidez com que a célula se torna refratária durante o potencial de ação.</li>
            <li>Gate (v_gate): O limiar de voltagem que alterna o comportamento da variável <code>h</code> entre recuperação e inativação.</li>
            <li>Inicio: O tempo (em ms) em que o estímulo é aplicado.</li>
            <li>Duração: A duração (em ms) do pulso de estímulo.</li>
            <li>Amplitude: A intensidade do estímulo (<code>I_stim</code>).</li>
            <li>Dt: O passo de tempo da simulação numérica.</li>
          </ul>
        </div>
      </Modal>
    </div>
  );
};

export default S1S2Page;