import { useState, useEffect, useCallback } from 'react';
import Chart from '../../components/Chart';
import Input from '../../components/Input';
import Button from '../../components/Button';
import Modal from '../../components/Modal'; 
import './styles.css';
import SimulationWorker from '../../simulation_8_stimuli.worker.js?worker';
import { useTranslation } from 'react-i18next';

const MultipleStimuliPage = ({ onBack }) => {
  const { t } = useTranslation();
  // Armazena os dados da simulação
  const [data, setData] = useState([]);
  
  // Armazena o worker
  const [worker, setWorker] = useState(null);
  
  // Indica se a simulação está em execução
  const [loading, setLoading] = useState(false);

  // Estado para o modal de informações
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);

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
    downsamplingFactor: 100, 
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

  const handleSimularClick = useCallback(() => {
    if (worker) {
      setLoading(true);
      worker.postMessage(editableParams);
    }
  }, [worker, editableParams]);

  return (
    <div className="page-container">
      {/* Botão para voltar a página inicial */}
      <Button onClick={onBack}>{t('common.back')}</Button>

      {/* Título da página */}
      <h1>{t('home.models.multiple_stimuli.title')}</h1>

      {/* Campos de entrada dos parâmetros */}
      <div className="params-container">
        {Object.keys(editableParams).map((key) => (
          <Input
            key={key}
            label={t(`params.${key}`)} // Formata a label
            value={editableParams[key]}
            onChange={(e) => handleChange(e, key)}
          />
        ))}
      </div>

      {/* Botão para iniciar a simulação */}
      <Button onClick={handleSimularClick} disabled={loading}>
        {loading ? t('common.simulating') : t('common.simulate')}
      </Button>

      {/* Exibe o gráfico com os resultados */}
      <Chart data={data} />

      {/* Botão e Modal de Informações */}
      <div style={{ marginTop: '20px' }}>
        <Button onClick={() => setIsInfoModalOpen(true)}>
          {t('common.more_info')}
        </Button>
      </div>

      <Modal isOpen={isInfoModalOpen} onClose={() => setIsInfoModalOpen(false)}>
        <div className="info-modal-content">
          <h2>{t('home.models.multiple_stimuli.title')}</h2>
          
          <h3>{t('modals.math_model')}</h3>
          <p>{t('modals.single.desc')}</p>
          <p>As equações do modelo são:</p>
          <ul>
            <li><code>{t('modals.single.eq_v')}</code></li>
            <li><code>{t('modals.single.eq_h1')}</code></li>
            <li><code>{t('modals.single.eq_h2')}</code></li>
          </ul>
          
          <h3>{t('modals.multiple.protocol_title')}</h3>
          <p>{t('modals.multiple.protocol_desc')}</p>

          <h3>{t('modals.numerical_method')}</h3>
          <p>{t('modals.single.method')}</p>

          <h3>{t('modals.param_meaning')}</h3>
          <ul>
            <li>{t('params.despolarização')}</li>
            <li>{t('params.repolarização')}</li>
            <li>{t('params.recuperação')}</li>
            <li>{t('params.inativação')}</li>
            <li>{t('params.gate')}</li>
            <li>{t('params.BCL')}</li>
            <li>{t('params.num_estimulos')}</li>
          </ul>
        </div>
      </Modal>
    </div>
  );
};

export default MultipleStimuliPage;