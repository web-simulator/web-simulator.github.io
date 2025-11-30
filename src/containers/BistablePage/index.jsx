import { useState, useEffect, useCallback } from 'react';
import BistableChart from '../../components/BistableChart';
import SpatiotemporalChart from '../../components/SpatiotemporalChart';
import Input from '../../components/Input';
import Button from '../../components/Button';
import Modal from '../../components/Modal';
import Chart from '../../components/Chart';
import SimulationWorker from '../../simulation_bistable.worker.js?worker';
import { useTranslation } from 'react-i18next';
import './styles.css';

const BistablePage = ({ onBack }) => {
  const { t } = useTranslation();
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
    A: 1.0,
    alpha: 0.1,
    L: 100,
    dx: 1,
    dt: 0.1,
    totalTime: 100,
    downsamplingFactor: 10,
  });

  // Configura Worker quando o componente é montado
  useEffect(() => {
    const simulationWorker = new SimulationWorker();
    setWorker(simulationWorker);

    // Receber os dados da simulação
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

  // Reproduzir a simulação em um loop com velocidade ajustável
  useEffect(() => {
    let interval;
    if (isPlaying && simulationData.length > 0) {
      const delay = 101 - simulationSpeed; 
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
    return () => clearInterval(interval);
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
      worker.postMessage(editableParams);
    }
  }, [worker, editableParams]);

  // Mudança no controle deslizante
  const handleSliderChange = (e) => {
    setIsPlaying(false);
    setCurrentFrame(parseInt(e.target.value, 10));
  };
  
  // Modal para exibir o gráfico ao clicar em um ponto
  const handlePointClick = useCallback((xIndex) => {
    setSelectedX(xIndex);
    setIsModalOpen(true);
  }, []);

  // Filtra a série com base no 'selectedX'
  const getTimeseriesForPoint = () => {
    if (selectedX === null || simulationData.length === 0) return [];
    return simulationData.map(frame => ({
      tempo: parseFloat(frame.time),
      v: frame.data[selectedX].v,
    }));
  };

  const currentChartData = simulationData[currentFrame]?.data;
  const timeseriesData = getTimeseriesForPoint();

  return (
    <div className="page-container">
      <Button onClick={onBack}>{t('common.back')}</Button>
      <h1>{t('home.models.bistable.title')}</h1>

      {/* Inputs para os parâmetros da simulação */}
      <div className="params-container">
        {Object.keys(editableParams).map((key) => (
          <Input
            key={key}
            label={t(`params.${key}`)}
            value={editableParams[key]}
            onChange={(e) => handleChange(e, key)}
          />
        ))}
      </div>

      {/* Controles da simulação */}
      <div className="button-container">
        <Button onClick={handleSimularClick} disabled={loading}>
          {loading ? t('common.simulating') : t('common.simulate')}
        </Button>
        <Button onClick={() => setIsPlaying(!isPlaying)} disabled={simulationData.length === 0}>
          {isPlaying ? t('common.pause') : t('common.resume')}
        </Button>
        <Button onClick={() => setViewMode(viewMode === 'line' ? 'color' : 'line')} disabled={simulationData.length === 0}>
          {viewMode === 'line' ? t('common.color_chart') : t('common.line_chart')}
        </Button>
      </div>

      {/* Renderiza o gráfico de linha ou de cores */}
      {viewMode === 'line' ? (
        <BistableChart data={currentChartData} />
      ) : (
        <SpatiotemporalChart simulationData={simulationData} currentFrame={currentFrame} onPointClick={handlePointClick} />
      )}
      
      {/* Renderiza o controle deslizante de tempo */}
      {simulationData.length > 0 && (
        <>
          <div className="slider-container">
            <label>{t('common.time')}: {simulationData[currentFrame]?.time || 0} ms</label>
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
            <label>{t('common.speed')}</label>
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
          {t('common.more_info')}
        </Button>
      </div>

      {/* Modal para gráfico de ponto */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
        <h2>Potencial em X = {selectedX !== null ? (selectedX * editableParams.dx).toFixed(2) : ''}</h2>
        <Chart data={timeseriesData} />
      </Modal>

      {/* Modal para Informações */}
      <Modal isOpen={isInfoModalOpen} onClose={() => setIsInfoModalOpen(false)}>
        <div className="info-modal-content">
          <h2>{t('home.models.bistable.title')}</h2>
          <h3>{t('modals.math_model')}</h3>
          <p>{t('modals.bistable.desc')}</p>
          <p>A equação utilizada é:</p>
          <ul>
            <li><code>{t('modals.bistable.eq')}</code></li>
          </ul>
          
          <h3>{t('modals.numerical_method')}</h3>
          <p>A equação é resolvida usando Diferenças Finitas de 2ª Ordem para o espaço e Runge-Kutta de 4ª Ordem no tempo.</p>

          <h3>{t('modals.param_meaning')}</h3>
          <ul>
            <li>{t('params.k')}</li>
            <li>{t('params.A')}</li>
            <li>{t('params.alpha')}</li>
            <li>{t('params.L')}</li>
            <li>{t('params.dx')}</li>
            <li>{t('params.dt')}</li>
            <li>{t('params.totalTime')}</li>
          </ul>
        </div>
      </Modal>
    </div>
  );
};

export default BistablePage;