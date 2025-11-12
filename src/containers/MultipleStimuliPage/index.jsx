import { useState, useEffect, useCallback } from 'react';
import Chart from '../../components/Chart';
import Input from '../../components/Input';
import Button from '../../components/Button';
import Modal from '../../components/Modal'; // Importar o Modal
import './styles.css';
import SimulationWorker from '../../simulation_8_stimuli.worker.js?worker';

const MultipleStimuliPage = ({ onBack }) => {
  // Armazena os dados da simulação
  const [data, setData] = useState([]);
  
  // Armazena o worker
  const [worker, setWorker] = useState(null);
  
  // Indica se a simulação está em execução
  const [loading, setLoading] = useState(false);

  // Estado para o modal de informações
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
/*
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
    downsamplingFactor: 50
  });
*/

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
  dt: 0.01,
  v_inicial: 0.0,
  h_inicial: 1.0,
  downsamplingFactor: 100, // Adicione este se quiser controle
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
/*
  // Inicia a simulação ao clicar no botão
  const handleSimularClick = useCallback(() => {
    if (worker) {
      setLoading(true); // Inicia o carregamento
      const allParams = { ...editableParams, ...fixedParams }; // Junta todos os parâmetros
      worker.postMessage(allParams); // Envia os parâmetros para iniciar a simulação
    }
  }, [worker, editableParams, fixedParams]);
*/
const handleSimularClick = useCallback(() => {
  if (worker) {
    setLoading(true);
    worker.postMessage(editableParams);
  }
}, [worker, editableParams]);
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

      {/* Botão e Modal de Informações */}
      <div style={{ marginTop: '20px' }}>
        <Button onClick={() => setIsInfoModalOpen(true)}>
          Saiba mais sobre essa simulação
        </Button>
      </div>

      <Modal isOpen={isInfoModalOpen} onClose={() => setIsInfoModalOpen(false)}>
        <div className="info-modal-content">
          <h2>Múltiplos Estímulos</h2>
          
          <h3>Modelo Matemático</h3>
          <p>
            Esta simulação usa o modelo Mitchell-Schaeffer para descrever o potencial de ação cardíaco. É um modelo de duas variáveis,
            o que significa que simula o comportamento de uma única célula.
          </p>
          <p>As equações do modelo são:</p>
          <ul>
            <li><code>dv/dt = (h * v² * (1 - v)) / τ_in - v / τ_out + I_stim</code></li>
            <li><code>dh/dt = (1 - h) / τ_open</code> (se <code>v &lt; v_gate</code>)</li>
            <li><code>dh/dt = -h / τ_close</code> (se <code>v ≥ v_gate</code>)</li>
          </ul>
          
          <h3>Protocolo de Estimulação</h3>
          <p>
            Em vez de um único pulso, uma sequência de <code>num_estimulos</code> estímulos é aplicada. 
            O parâmetro BCL (Basic Cycle Length) define o intervalo de tempo (em ms) entre o início de um estímulo e o início do próximo.
          </p>

          <h3>Método Numérico</h3>
          <p>
            As equações são resolvidas numericamente usando o método Runge-Kutta de 4ª Ordem.
          </p>

          <h3>Significado dos Parâmetros</h3>
          <ul>
            <li>Despolarização (τ_in): Controla a velocidade de ascensão do potencial de ação.</li>
            <li>Repolarização (τ_out): Controla a velocidade de repolarização.</li>
            <li>Recuperação (τ_open): Controla o tempo de recuperação da excitabilidade.</li>
            <li>Inativação (τ_close): Controla o tempo de inativação (período refratário).</li>
            <li>Gate (v_gate): O limiar de voltagem que alterna o comportamento de <code>h</code>.</li>
            <li>BCL: O intervalo entre os estímulos.</li>
            <li>Num Estimulos: O número total de estímulos aplicados.</li>
          </ul>
        </div>
      </Modal>
    </div>
  );
};

export default MultipleStimuliPage;