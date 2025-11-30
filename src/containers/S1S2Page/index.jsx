import { useState, useEffect, useCallback } from 'react';
import Chart from '../../components/Chart';
import Input from '../../components/Input';
import Button from '../../components/Button';
import Modal from '../../components/Modal'; 
import SimulationWorker from '../../simulation_s1_s2.worker.js?worker';
import { useTranslation } from 'react-i18next';
import './styles.css';

const S1S2Page = ({ onBack }) => {
  const { t } = useTranslation();
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
      <Button onClick={onBack}>{t('common.back')}</Button>
      <h1>{t('home.models.s1_s2.title')}</h1>
      
      {/* Inputs */}
      <h2>{t('common.simulation_params')}</h2>
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

      <Button onClick={handleSimularClick} disabled={loading}>
        {loading ? t('common.simulating') : t('common.simulate')}
      </Button>

      <Chart data={data} />

      {/* Botão e Modal de Informações */}
      <div style={{ marginTop: '20px' }}>
        <Button onClick={() => setIsInfoModalOpen(true)}>
          {t('common.more_info')}
        </Button>
      </div>

      <Modal isOpen={isInfoModalOpen} onClose={() => setIsInfoModalOpen(false)}>
        <div className="info-modal-content">
          <h2>{t('home.models.s1_s2.title')}</h2>
          
          <h3>{t('modals.s1s2.protocol_title')}</h3>
          <p>{t('modals.s1s2.protocol_desc')}</p>
          <ul>
            <li><strong>S1:</strong> {t('modals.s1s2.s1_desc')}</li>
            <li><strong>S2:</strong> {t('modals.s1s2.s2_desc')}</li>
          </ul>
          <p>
            Ao variar o <code>intervalo_S2</code>, pode-se encontrar o menor intervalo que ainda consegue gerar um potencial de ação, definindo assim o período refratário da célula.
          </p>
          
          <h3>{t('modals.math_model')}</h3>
          <p>O modelo celular é o Mitchell-Schaeffer:</p>
          <ul>
            <li><code>{t('modals.single.eq_v')}</code></li>
            <li><code>{t('modals.single.eq_h1')}</code></li>
            <li><code>{t('modals.single.eq_h2')}</code></li>
          </ul>

          <h3>{t('modals.numerical_method')}</h3>
          <p>{t('modals.single.method')}</p>

          <h3>{t('modals.param_meaning')}</h3>
          <ul>
            <li>{t('params.BCL_S1')}</li>
            <li>{t('params.intervalo_S2')}</li>
            <li>{t('params.num_estimulos_s1')}</li>
            <li>{t('params.despolarização')}</li>
            <li>{t('params.repolarização')}</li>
            <li>{t('params.recuperação')}</li>
            <li>{t('params.inativação')}</li>
            <li>{t('params.gate')}</li>
            <li>{t('params.inicio')}</li>
            <li>{t('params.duração')}</li>
            <li>{t('params.amplitude')}</li>
            <li>{t('params.dt')}</li>
          </ul>
        </div>
      </Modal>
    </div>
  );
};

export default S1S2Page;