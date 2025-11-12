import { useState, useEffect, useCallback } from 'react';
import MS1DChart from '../../components/MS1DChart';
import SpatiotemporalChart from '../../components/SpatiotemporalChart';
import Input from '../../components/Input';
import Button from '../../components/Button';
import Modal from '../../components/Modal';
import Chart from '../../components/Chart';
import SimulationWorker from '../../simulation_ms_1d.worker.js?worker';
import './styles.css';

const MitchellSchaeffer1DPage = ({ onBack }) => {
  // Estados para gerenciar a simulação 
  const [simulationData, setSimulationData] = useState([]);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [worker, setWorker] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [viewMode, setViewMode] = useState('line');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [selectedX, setSelectedX] = useState(null);
  const [simulationSpeed, setSimulationSpeed] = useState(50);

  // Parâmetros da simulação que o usuário pode alterar
  const [editableParams, setEditableParams] = useState({
    k: 2.0,
    Tau_in: 0.3,
    Tau_out: 6.0,
    Tau_open: 120.0,
    Tau_close: 80.0,
    gate: 0.13,
    L: 100,
    dx: 1,
    dt: 0.05,
    totalTime: 500,
    downsamplingFactor: 10,
    inicio: 5.0,
    duracao: 1.0,
    amplitude: 1.0,
    posição_do_estímulo: 10,
    tamanho_do_estímulo: 5,
    num_estimulos: 8,
    BCL: 250
  });

  // Configura o Worker 
  useEffect(() => {
    const simulationWorker = new SimulationWorker();
    setWorker(simulationWorker);

    // Recebe os dados da simulação
    simulationWorker.onmessage = (e) => {
      setSimulationData(e.data);
      setCurrentFrame(0);
      setLoading(false);
      setIsPlaying(true);
    };

    // Função de limpeza
    return () => {
      simulationWorker.terminate();
    };
  }, []);

  // Simulação em um loop com velocidade ajustável
  useEffect(() => {
    let interval;
    if (isPlaying && simulationData.length > 0) {
      const delay = 101 - simulationSpeed; // Ajusta o delay com base na velocidade
      interval = setInterval(() => {
        setCurrentFrame((prevFrame) => {
          const nextFrame = prevFrame + 1;
          if (nextFrame >= simulationData.length) {
            setIsPlaying(false);
            return prevFrame;
          }
          return nextFrame;
        });
      }, delay);
    }
    return () => clearInterval(interval); // Limpa o intervalo
  }, [isPlaying, simulationData, simulationSpeed]);

  // Atualiza os parâmetros quando o usuário muda os valores nos inputs
  const handleChange = useCallback((e, name) => {
    const value = parseFloat(e.target.value);
    setEditableParams((prev) => ({ ...prev, [name]: value }));
  }, []);

  // Inicia a simulação
  const handleSimularClick = useCallback(() => {
    if (worker) {
      setLoading(true);
      setSimulationData([]);
      setIsPlaying(false);
      // Envia os parâmetros para o worker
      worker.postMessage(editableParams);
    }
  }, [worker, editableParams]);

  // Mudança no controle deslizante de tempo
  const handleSliderChange = (e) => {
    setIsPlaying(false);
    setCurrentFrame(parseInt(e.target.value, 10));
  };
  
  // Clique no gráfico de cores para mostrar o modal
  const handlePointClick = useCallback((xIndex) => {
    setSelectedX(xIndex);
    setIsModalOpen(true);
  }, []);

  // Filtra com base no 'selectedX'
  const getTimeseriesForPoint = () => {
    if (selectedX === null || simulationData.length === 0) return [];
    return simulationData.map(frame => ({
      tempo: parseFloat(frame.time),
      v: frame.data[selectedX].v,
      h: frame.data[selectedX].h,
    }));
  };

  const currentChartData = simulationData[currentFrame]?.data || [];
  const timeseriesData = getTimeseriesForPoint();

  return (
    <div className="page-container">
      <Button onClick={onBack}>Voltar para Home</Button>
      <h1>Modelo Mitchell-Schaeffer 1D</h1>

      {/* Inputs para os parâmetros da simulação */}
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
      
      {/* Controles da simulação */}
      <div className="button-container">
        <Button onClick={handleSimularClick} disabled={loading}>
          {loading ? 'Simulando...' : 'Simular'}
        </Button>
        <Button onClick={() => setIsPlaying(!isPlaying)} disabled={simulationData.length === 0}>
          {isPlaying ? 'Pausar' : 'Retomar'}
        </Button>
        <Button onClick={() => setViewMode(viewMode === 'line' ? 'color' : 'line')} disabled={simulationData.length === 0}>
          {viewMode === 'line' ? 'Gráfico de Cores' : 'Gráfico de Linhas'}
        </Button>
      </div>

      {/* Renderiza o gráfico de linha ou de cores */}
      {viewMode === 'line' ? (
        <MS1DChart 
          data={currentChartData} 
          windowSize={editableParams.L} 
          scrollPosition={0} 
        />
      ) : (
        <SpatiotemporalChart simulationData={simulationData} currentFrame={currentFrame} onPointClick={handlePointClick} />
      )}

      {/* Renderiza os controles deslizantes */}
      {simulationData.length > 0 && (
        <>
          <div className="slider-container">
            <label>Tempo: {simulationData[currentFrame]?.time || 0} ms</label>
            <input
              type="range"
              min="0"
              max={simulationData.length - 1}
              value={currentFrame}
              onChange={handleSliderChange}
              className="slider"
            />
          </div>
          {/* Controle de Velocidade */}
          <div className="slider-container">
            <label>Velocidade da Animação</label>
            <input
              type="range"
              min="1"
              max="100"
              value={simulationSpeed}
              onChange={(e) => setSimulationSpeed(parseInt(e.target.value, 10))}
              className="slider"
            />
          </div>
        </>
      )}

      {/* Botão e Modal de Informações */}
      <div style={{ marginTop: '20px' }}>
        <Button onClick={() => setIsInfoModalOpen(true)}>
          Saiba mais sobre essa simulação
        </Button>
      </div>

      {/* Modal para exibir o gráfico de um ponto clicado. */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
        <h2>Potencial em X = {selectedX !== null ? (selectedX * editableParams.dx).toFixed(2) : ''}</h2>
        <Chart data={timeseriesData} />
      </Modal>

      {/* Modal para Informações */}
      <Modal isOpen={isInfoModalOpen} onClose={() => setIsInfoModalOpen(false)}>
        <div className="info-modal-content">
          <h2>Modelo Mitchell-Schaeffer 1D</h2>
          
          <h3>Modelo Matemático</h3>
          <p>
            Esta é a versão 1D do modelo Mitchell-Schaeffer. Ele adiciona um termo de difusão espacial à equação da voltagem <code>v</code>, permitindo a propagação da onda.
          </p>
          <p>As equações de reação-difusão são:</p>
          <ul>
            <li><code>∂v/∂t = k * (∂²v/∂x²) + (h * v² * (1 - v)) / τ_in - v / τ_out + I_stim</code></li>
            <li><code>∂h/∂t = (1 - h) / τ_open</code> (se <code>v &lt; v_gate</code>)</li>
            <li><code>∂h/∂t = -h / τ_close</code> (se <code>v ≥ v_gate</code>)</li>
          </ul>
          <p>
            O estímulo (<code>I_stim</code>) é aplicado em uma região específica definida por <code>posição_do_estímulo</code> e <code>tamanho_do_estímulo</code>.
          </p>
          <h3>Método Numérico</h3>
          <ol>
            <li>O termo de difusão espacial <code>k * (∂²v/∂x²)</code> é aproximado usando Diferenças Finitas de 2ª Ordem.</li>
            <li>Isso transforma a Equação Diferencial Parcial em um grande sistema de Equações Diferenciais Ordinárias, uma para cada ponto <code>i</code> no cabo.</li>
            <li>Esse sistema de EDOs é resolvido no tempo usando Runge-Kutta de 4ª Ordem .</li>
          </ol>

          <h3>Significado dos Parâmetros</h3>
          <ul>
            <li>k (Condutividade): Controla a velocidade de propagação da onda.</li>
            <li>Despolarização (τ_in): Controla a velocidade da fase de ascensão do potencial de ação. Um valor menor torna a subida mais rápida.</li>
            <li>Repolarização (τ_out): Controla a velocidade da fase de repolarização. Um valor menor torna a descida mais rápida.</li>
            <li>Recuperação (τ_open): Controla o tempo que a célula leva para se tornar excitável novamente.</li>
            <li>Inativação (τ_close): Controla a velocidade com que a célula se torna refratária durante o potencial de ação.</li>
            <li>Gate (v_gate): Limite de voltagem que alterna o comportamento da variável <code>h</code> entre recuperação e inativação.</li>
            <li>L, dx: Comprimento do cabo e discretização espacial.</li>
            <li>dt: Passo de tempo da simulação.</li>
            <li>Posição/Tamanho do Estímulo: Define a região onde <code>I_stim</code> é aplicado.</li>
            <li>Num Estimulos / BCL: Define quantos estímulos são aplicados e o intervalo entre eles.</li>
          </ul>
        </div>
      </Modal>
    </div>
  );
};
export default MitchellSchaeffer1DPage;