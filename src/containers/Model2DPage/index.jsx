import { useState, useEffect, useCallback } from 'react';
import HeatmapChart from '../../components/HeatmapChart';
import Colorbar from '../../components/Colorbar';
import Input from '../../components/Input';
import Button from '../../components/Button';
import Modal from '../../components/Modal';
import Chart from '../../components/Chart';
import SimulationWorker from '../../simulation_2d.worker.js?worker';
import './styles.css';

// Único estímulo na lista
const StimulusEditor = ({ stimulus, onUpdate, onRemove, index, paramTranslations }) => {
  // Lida com a mudança de paraâmetros do estímulo
  const handleParamChange = (name, value) => {
    onUpdate(stimulus.id, { ...stimulus, [name]: value });
  };

  // Lida com a mudança do formato dos estimulos 
  const handleShapeParamChange = (shape, name, value) => {
    onUpdate(stimulus.id, { ...stimulus, [shape]: { ...stimulus[shape], [name]: value } });
  };

  return (
    <div className="stimulus-editor">
      <h4>
        Estímulo {index + 1}
        {/* Remover aparece apenas se não for o primeiro estímulo */}
        {index > 0 && <Button onClick={() => onRemove(stimulus.id)} style={{ float: 'right', padding: '5px 10px', fontSize: '12px' }}>Remover</Button>}
      </h4>
      <div className="params-container">
        {index === 0 ? (
          <Input label={paramTranslations['startTime']} value={stimulus.startTime} onChange={(e) => handleParamChange('startTime', parseFloat(e.target.value))} />
        ) : (
          <Input label={paramTranslations['intervalo']} value={stimulus.interval} onChange={(e) => handleParamChange('interval', parseFloat(e.target.value))} />
        )}
        <Input label={paramTranslations['duracao']} value={stimulus.duration} onChange={(e) => handleParamChange('duration', parseFloat(e.target.value))} />
        <Input label={paramTranslations['amplitude']} value={stimulus.amplitude} onChange={(e) => handleParamChange('amplitude', parseFloat(e.target.value))} />
        
        {/* Seleção para a forma do estímulo */}
        <div className="input-container">
          <label>Formato</label>
          <select value={stimulus.shape} onChange={(e) => handleParamChange('shape', e.target.value)}>
            <option value="rectangle">Retangular</option>
            <option value="circle">Circular</option>
          </select>
        </div>
        
        {/* Mostra os inputs com as informações decada estimulo */}
        {stimulus.shape === 'rectangle' ? (
          Object.keys(stimulus.rectParams).map(key => (
            <Input key={key} label={paramTranslations[key] || key} value={stimulus.rectParams[key]} onChange={(e) => handleShapeParamChange('rectParams', key, parseFloat(e.target.value))} />
          ))
        ) : (
          Object.keys(stimulus.circleParams).map(key => (
            <Input key={key} label={paramTranslations[key] || key} value={stimulus.circleParams[key]} onChange={(e) => handleShapeParamChange('circleParams', key, parseFloat(e.target.value))} />
          ))
        )}
      </div>
    </div>
  );
};

// Pagina principal
const Model2DPage = ({ onBack }) => {
  const [simulationData, setSimulationData] = useState([]);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [worker, setWorker] = useState(null); 
  const [loading, setLoading] = useState(false); 
  const [isPlaying, setIsPlaying] = useState(false); 
  const [simulationSpeed, setSimulationSpeed] = useState(50); 

  // Parâmetros do modelo
  const [ms2dParams, setMs2dParams] = useState({
    k: 0.004,
    Tau_in: 0.3,
    Tau_out: 6.0,
    Tau_open: 120.0,
    Tau_close: 80.0,
    gate: 0.13,
    L: 10,
    dt: 0.05,
    dx: 0.2,
    totalTime: 3000,
    downsamplingFactor: 10,
  });

  // Lista de estímulos
  const [stimuli, setStimuli] = useState([
    {
      id: 1, // id do estímulo
      startTime: 0, // Tempo de início 
      interval: 0, // Intervalo
      duration: 2,
      amplitude: 1.0,
      shape: 'rectangle', // Forma do estímulo
      rectParams: { x1: 0.0, y1: 0.0, x2: 1, y2: 10.0 }, // Parâmetros se for retângulo
      circleParams: { cx: 0.5, cy: 0.5, radius: 0.1 } // Parâmetros se for círculo
    },
    {
      id: 2,
      startTime: 0, // calcula automaticamente 
      interval: 275, // Intervalo apos o anteriror  
      duration: 2,
      amplitude: 1.0,
      shape: 'rectangle',
      rectParams: { x1: 6, y1: 3, x2: 8, y2: 7 },
      circleParams: { cx: 0.8, cy: 0.3, radius: 0.1 }
    }
  ]);

  // Região de fibrose
  const [fibrosisParams, setFibrosisParams] = useState({
    enabled: false, // Ativa ou não
    conductivity: 0.0, // Condutividade
    density: 0.1, // Densidade 
    regionSize: 0.2, // Tamanho
    seed: Date.now(), // Semente 
  });

  // Modal para o gráfico do ponto clicado
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [selectedPoint, setSelectedPoint] = useState(null);

  // Adiciona um novo estímulo à lista
  const addStimulus = () => {
    const newStimulus = {
      id: Date.now(),
      startTime: 0,
      interval: 200, // Intervalo padrão
      duration: 2,
      amplitude: 1.0,
      shape: 'rectangle',
      rectParams: { x1: 0, y1: 0, x2: 0.1, y2: 1.0 },
      circleParams: { cx: 0.5, cy: 0.5, radius: 0.1 }
    };
    setStimuli(prev => [...prev, newStimulus]);
  };

  // Remover um estímulo da lista
  const removeStimulus = (id) => {
    setStimuli(prev => prev.filter(s => s.id !== id));
  };

  // Atualizar os dados de um estímulo
  const updateStimulus = (id, updatedStimulus) => {
    setStimuli(prev => prev.map(s => s.id === id ? updatedStimulus : s));
  };
  
  // Configura o worker
  useEffect(() => {
    const simulationWorker = new SimulationWorker();
    setWorker(simulationWorker);

    
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
      const delay = 101 - simulationSpeed; 
      interval = setInterval(() => {
        setCurrentFrame((prev) => (prev + 1 >= simulationData.length ? prev : prev + 1));
      }, delay);
    }
    return () => clearInterval(interval);
  }, [isPlaying, simulationData, simulationSpeed]);

  // Atualizar os parâmetros
  const handleParamChange = (setter) => useCallback((e, name) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : parseFloat(e.target.value);
    setter((prev) => ({ ...prev, [name]: value }));
  }, [setter]);
  
  // parametrod do modelo e da fibrose
  const handleMs2dChange = handleParamChange(setMs2dParams);
  const handleFibrosisChange = handleParamChange(setFibrosisParams);

  // Quando clica em simular
  const handleSimularClick = useCallback(() => {
    if (worker) {
      setLoading(true);
      setSimulationData([]);
      setIsPlaying(false);
      
      // Envia todos os parâmetros para o worker
      worker.postMessage({
        modelType: 'ms2d',
        ...ms2dParams,
        stimuli, // Passa a lista de estímulos
        fibrosisParams,
      });
    }
  }, [worker, ms2dParams, stimuli, fibrosisParams]);

  // barra de tempo
  const handleSliderChange = (e) => {
    setIsPlaying(false);
    setCurrentFrame(parseInt(e.target.value, 10));
  };
  
  // Abre o modal ao clicar em um ponto
  const handlePointClick = useCallback((point) => {
    setSelectedPoint(point); // Guarda as coordenadas do ponto
    setIsModalOpen(true); // Abre o modal
  }, []);

  // Gera os dados do gráfico do ponto clicado
  const getTimeseriesForPoint = () => {
    if (!selectedPoint || !simulationData || simulationData.length === 0) return [];
    
    // Pega o V do ponto selecionado ao longo do tempo
    return simulationData.map(frame => ({
      tempo: parseFloat(frame.time),
      v: frame.data[selectedPoint.i][selectedPoint.j],
    }));
  };

  //Dados para passar para o HeatmapChart
  const currentChartData = simulationData[currentFrame]?.data || [];
  const currentFibrosisMap = simulationData[currentFrame]?.fibrosisMap || [];
  const timeseriesData = getTimeseriesForPoint(); 

  const paramTranslations = {
    k: "Condutividade (k)", Tau_in: "Tau in", Tau_out: "Tau out", Tau_open: "Tau open", Tau_close: "Tau close", gate: "Gate", L: "Comprimento", dt: "dt", dx: "dx", totalTime: "Tempo Total",
    duracao: "Duração (ms)", amplitude: "Amplitude", startTime: "Início (ms)", intervalo: "Intervalo Após Anterior (ms)",
    downsamplingFactor: "Fator de Redução", radius: "Raio", cx: "Centro X", cy: "Centro Y", x1: "X1", y1: "Y1", x2: "X2", y2: "Y2",
    conductivity: "Condutividade (k)", density: "Densidade", seed: "Semente", regionSize: "Tamanho da Região"
  };

  // Estrutura da página
  return (
    <div className="page-container">
      <Button onClick={onBack}>Voltar para Home</Button>
      <h1>Modelo de Simulação 2D</h1>
      
      <h2>Parâmetros da Simulação</h2>
      <div className="params-container">
        {Object.keys(ms2dParams).map((key) => (
          <Input key={key} label={paramTranslations[key] || key} value={ms2dParams[key]} onChange={(e) => handleMs2dChange(e, key)} />
        ))}
      </div>

      <h2>Protocolo de Estímulos em Lista</h2>
      {stimuli.map((stim, index) => (
        <StimulusEditor 
          key={stim.id}
          index={index}
          stimulus={stim}
          onUpdate={updateStimulus}
          onRemove={removeStimulus}
          paramTranslations={paramTranslations}
        />
      ))}
      <Button onClick={addStimulus} style={{ marginTop: '10px' }}>Adicionar Estímulo</Button>
      
      <h2>Parâmetros da Fibrose</h2>
      <div className="params-container">
          <div className="input-container" style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <label htmlFor="fibrosis-enabled">Habilitar Fibrose</label>
              <input type="checkbox" id="fibrosis-enabled" checked={fibrosisParams.enabled} onChange={(e) => setFibrosisParams(prev => ({...prev, enabled: e.target.checked}))} />
          </div>
          {fibrosisParams.enabled && <>
              <Input label={paramTranslations['conductivity']} value={fibrosisParams.conductivity} onChange={(e) => handleFibrosisChange(e, 'conductivity')} />
              <Input label={paramTranslations['density']} value={fibrosisParams.density} onChange={(e) => handleFibrosisChange(e, 'density')} />
              <Input label={paramTranslations['regionSize']} value={fibrosisParams.regionSize} onChange={(e) => handleFibrosisChange(e, 'regionSize')} />
              <Input label={paramTranslations['seed']} value={fibrosisParams.seed} onChange={(e) => handleFibrosisChange(e, 'seed')} />
          </>
          }
      </div>

      <div className="button-container">
        <Button onClick={handleSimularClick} disabled={loading}>{loading ? 'Simulando...' : 'Simular'}</Button>
        <Button onClick={() => setIsPlaying(!isPlaying)} disabled={simulationData.length === 0}>{isPlaying ? 'Pausar' : 'Retomar'}</Button>
      </div>

      <div className="chart-colorbar-wrapper">
        <HeatmapChart 
            data={currentChartData} 
            maxValue={1.0} 
            onPointClick={handlePointClick}
            fibrosisMap={currentFibrosisMap} 
            fibrosisConductivity={fibrosisParams.conductivity}
        />
        {simulationData.length > 0 && <Colorbar maxValue={1.0} minValue={0} />}
      </div>

      {simulationData.length > 0 && (
        <>
          <div className="slider-container">
            <label>Tempo: {simulationData[currentFrame]?.time || 0}</label>
            <input type="range" min="0" max={simulationData.length - 1} value={currentFrame} onChange={handleSliderChange} className="slider" />
          </div>
          <div className="slider-container">
            <label>Velocidade da Animação</label>
            <input type="range" min="1" max="100" value={simulationSpeed} onChange={(e) => setSimulationSpeed(parseInt(e.target.value, 10))} className="slider" />
          </div>
        </>
      )}

      {/* Botão e Modal de Informações */}
      <div style={{ marginTop: '20px' }}>
        <Button onClick={() => setIsInfoModalOpen(true)}>
          Saiba mais sobre essa simulação
        </Button>
      </div>
      
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
        <h2>
          Potencial no Ponto (
            {selectedPoint ? `x: ${(selectedPoint.j * ms2dParams.dx).toFixed(2)}, y: ${(selectedPoint.i * ms2dParams.dx).toFixed(2)}` : ''}
          )
        </h2>
        <Chart data={timeseriesData} />
      </Modal>

      {/* Modal para Informações */}
      <Modal isOpen={isInfoModalOpen} onClose={() => setIsInfoModalOpen(false)}>
        <div className="info-modal-content">
          <h2>Modelo Mitchell-Schaeffer (2D)</h2>
          
          <h3>Modelo Matemático</h3>
          <p>
            Esta é a versão 2D do modelo Mitchell-Schaeffer, simulando a propagação de ondas em um tecido bidimensional.
          </p>
          <p>As equações de reação-difusão são:</p>
          <ul>
            <li><code>∂v/∂t = ∇ ⋅ (k(x,y) * ∇v) + (h * v² * (1 - v)) / τ_in - v / τ_out + I_stim</code></li>
            <li><code>∂h/∂t = (1 - h) / τ_open</code> (se <code>v &lt; v_gate</code>)</li>
            <li><code>∂h/∂t = -h / τ_close</code> (se <code>v ≥ v_gate</code>)</li>
          </ul>
          <p>
            O termo <code>∇ ⋅ (k(x,y) * ∇v)</code> é o termo de difusão em 2D, onde <code>k(x,y)</code> é a condutividade no ponto (x,y).
          </p>
          
          <h3>Método Numérico</h3>
          <p>
            A equação é resolvida usando Diferenças Finitas para o Laplaciano e Runge-Kutta de 4ª Ordem para o tempo.
          </p>

          <h3>Protocolo de Estímulos</h3>
          <p>
            Um protocolo de múltiplos estímulos é implementado. Cada estímulo pode ter uma forma (retângulo ou círculo) e um tempo de início (<code>startTime</code> para o primeiro, 
            <code>interval</code> para os próximos) definidos.
          </p>
          <h3>Parametros</h3>
          <ul>
            <li>Despolarização (τ_in): Controla a velocidade da fase de ascensão (despolarização) do potencial de ação. Um valor menor torna a subida mais rápida.</li>
            <li>Repolarização (τ_out): Controla a velocidade da fase de repolarização (descida). Um valor menor torna a descida mais rápida.</li>
            <li>Recuperação (τ_open): Controla o tempo que a célula leva para se tornar excitável novamente (recuperação da variável <code>h</code>).</li>
            <li>Inativação (τ_close): Controla a rapidez com que a célula se torna refratária durante o potencial de ação (inativação da variável <code>h</code>).</li>
            <li>Gate (v_gate): O limiar de voltagem que alterna o comportamento da variável <code>h</code> entre recuperação e inativação.</li>
            <li>inicio: Tempo de início do primeiro estímulo em ms.</li>
            <li>intervalo: Intervalo em ms após o estímulo anterior para os próximos estímulos.</li>
            <li>duracao: Duração do estímulo em ms.</li>
            <li>amplitude: Amplitude do estímulo aplicado ao potencial de ação.</li>
            <li>formato: Forma do estímulo, pode ser retangular ou circular.</li>
          </ul>

          <h3>Simulação de Fibrose</h3>
          <p>
            Quando habilitada, a fibrose é simulada criando regiões circulares aleatórias onde a condutividade <code>k</code> é reduzida para o valor de <code>conductivity</code>, bloqueando ou retardando a propagação da onda.
          </p>
          <ul>
            <li>condutividade (Fibrose): O valor de <code>k</code> dentro das regiões fibróticas.</li>
            <li>densidade: A fração da área do tecido coberta por fibrose.</li>
            <li>tamanho da região: O raio das regiões circulares de fibrose.</li>
            <li>semente: Semente para o gerador de números aleatórios, garantindo que o mesmo padrão de fibrose possa ser recriado.</li>
          </ul>
        </div>
      </Modal>
    </div>
  );
};

export default Model2DPage;