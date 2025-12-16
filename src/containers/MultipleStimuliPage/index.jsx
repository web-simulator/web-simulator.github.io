import { useState, useEffect, useCallback } from 'react';
import Chart from '../../components/Chart';
import Input from '../../components/Input';
import Button from '../../components/Button';
import Modal from '../../components/Modal'; 
import SimulationWorker from '../../simulation_8_stimuli.worker.js?worker';
import MinimalWorker from '../../simulation_minimal_0d.worker.js?worker';
import { useTranslation } from 'react-i18next';
import './styles.css';

const DEFAULT_MINIMAL_PARAMS = {
  endo: {
    u_o: 0.0, u_u: 1.56, theta_v: 0.3, theta_w: 0.13, theta_vminus: 0.2, theta_o: 0.006,
    tau_v1minus: 75.0, tau_v2minus: 10.0, tau_vplus: 1.4506,
    tau_w1minus: 6.0, tau_w2minus: 140.0, k_wminus: 200.0, u_wminus: 0.016, tau_wplus: 280.0,
    tau_fi: 0.15, tau_o1: 470.0, tau_o2: 6.0, tau_so1: 40.0, tau_so2: 1.2,
    k_so: 2.0, u_so: 0.65, tau_s1: 2.7342, tau_s2: 2.0, k_s: 2.0994, u_s: 0.9087, tau_si: 2.9013,
    tau_winf: 0.0273, w_infstar: 0.78
  },
  myo: {
    u_o: 0.0, u_u: 1.61, theta_v: 0.3, theta_w: 0.13, theta_vminus: 0.1, theta_o: 0.005,
    tau_v1minus: 80.0, tau_v2minus: 1.4506, tau_vplus: 1.4506,
    tau_w1minus: 70.0, tau_w2minus: 8.0, k_wminus: 200.0, u_wminus: 0.016, tau_wplus: 280.0,
    tau_fi: 0.117, tau_o1: 410.0, tau_o2: 7.0, tau_so1: 91.0, tau_so2: 0.8,
    k_so: 2.1, u_so: 0.6, tau_s1: 2.7342, tau_s2: 4.0, k_s: 2.0994, u_s: 0.9087, tau_si: 3.3849,
    tau_winf: 0.01, w_infstar: 0.5
  },
  epi: {
    u_o: 0.0, u_u: 1.55, theta_v: 0.3, theta_w: 0.13, theta_vminus: 0.006, theta_o: 0.006,
    tau_v1minus: 60.0, tau_v2minus: 1150.0, tau_vplus: 1.4506,
    tau_w1minus: 60.0, tau_w2minus: 15.0, k_wminus: 65.0, u_wminus: 0.03, tau_wplus: 200.0,
    tau_fi: 0.165, tau_o1: 400.0, tau_o2: 6.0, tau_so1: 30.0181, tau_so2: 0.9957,
    k_so: 2.0458, u_so: 0.65, tau_s1: 2.7342, tau_s2: 16.0, k_s: 2.0994, u_s: 0.9087, tau_si: 1.8875,
    tau_winf: 0.07, w_infstar: 0.94
  }
};

const MultipleStimuliPage = ({ onBack }) => {
  const { t } = useTranslation();
  const [data, setData] = useState([]);
  const [worker, setWorker] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  
  const [selectedModel, setSelectedModel] = useState('ms');
  const [minimalCustomParams, setMinimalCustomParams] = useState(DEFAULT_MINIMAL_PARAMS);

  const [editableParams, setEditableParams] = useState({
    ms: {
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
    },
    minimal: {
        cellType: 'epi',
        inicio: 10.0,
        duração: 1.0,
        amplitude: 1.0,
        BCL: 400,
        num_estimulos: 5,
        dt: 0.1,
        downsamplingFactor: 50,
    }
  });

  useEffect(() => {
    let simulationWorker;
    if (selectedModel === 'minimal') {
      simulationWorker = new MinimalWorker();
    } else {
      simulationWorker = new SimulationWorker();
    }
    setWorker(simulationWorker);

    // Define o que acontece quando o worker envia os resultados
    simulationWorker.onmessage = (e) => {
      setData(e.data);
      setLoading(false);
    };

    // Quando o componente é encerrado, encerra o worker
    return () => {
      simulationWorker.terminate();
    };
  }, [selectedModel]);

  // Atualiza os parâmetros editáveis quando o usuário altera os campos de entrada
  const handleChange = useCallback((e, name) => {
    const value = name === 'cellType' ? e.target.value : parseFloat(e.target.value);
    setEditableParams((prevParams) => ({ 
      ...prevParams, 
      [selectedModel]: {
        ...prevParams[selectedModel],
        [name]: value
      } 
    }));
  }, [selectedModel]);

  const handleMinimalCustomChange = (param, value) => {
    const activeType = editableParams.minimal.cellType;
    setMinimalCustomParams(prev => ({
      ...prev,
      [activeType]: {
        ...prev[activeType],
        [param]: parseFloat(value)
      }
    }));
  };

  const handleSimularClick = useCallback(() => {
    if (worker) {
      setLoading(true);
      const payload = { ...editableParams[selectedModel] };
      if (selectedModel === 'minimal') {
        payload.protocol = 'multiple';
        payload.minimalCellParams = minimalCustomParams;
      }
      worker.postMessage(payload);
    }
  }, [worker, editableParams, selectedModel, minimalCustomParams]);

  const currentParams = editableParams[selectedModel];

  return (
    <div className="page-container">
      {/* Botão para voltar a página inicial */}
      <Button onClick={onBack}>{t('common.back')}</Button>

      {/* Título da página */}
      <h1>{t('home.models.multiple_stimuli.title')}</h1>

      <div className="params-container">
        <div className="input-container">
          <label>{t('common.select_model')}</label>
          <select value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)}>
            <option value="ms">Mitchell-Schaeffer</option>
            <option value="minimal">{t('modals.restitution.minimal.title')}</option>
          </select>
        </div>
      </div>

      <h2>{t('common.simulation_params')}</h2>
      <div className="params-container">
        {selectedModel === 'minimal' && (
          <div className="input-container">
            <label>{t('params.cellType')}</label>
            <select 
              value={currentParams.cellType} 
              onChange={(e) => handleChange(e, 'cellType')}
              style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
            >
              <option value="epi">{t('params.epi')}</option>
              <option value="endo">{t('params.endo')}</option>
              <option value="myo">{t('params.myo')}</option>
            </select>
          </div>
        )}

        {Object.keys(currentParams).filter(key => key !== 'cellType').map((key) => (
          <Input
            key={key}
            label={t(`params.${key}`) || key}
            value={currentParams[key]}
            onChange={(e) => handleChange(e, key)}
          />
        ))}
      </div>

      {selectedModel === 'minimal' && (
        <div className="params-section">
            <h3 style={{marginTop: '20px'}}>Parâmetros da Célula ({t(`params.${currentParams.cellType}`)})</h3>
            <div className="params-container">
                {Object.keys(minimalCustomParams[currentParams.cellType]).map(key => (
                    <Input 
                        key={key}
                        label={t(`params.${key}`) || key}
                        value={minimalCustomParams[currentParams.cellType][key]}
                        onChange={(e) => handleMinimalCustomChange(key, e.target.value)}
                    />
                ))}
            </div>
        </div>
      )}

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
          
          <h3>{t('modals.multiple.protocol_title')}</h3>
          {selectedModel === 'ms' ? (
            <>
              <p>{t('modals.multiple.ms.desc')}</p>
              <h3>{t('modals.math_model')}</h3>
              <p>{t('modals.ms_desc_base')}</p>
              <ul>
                <li><code>{t('modals.single.ms.eq_v')}</code></li>
                <li><code>{t('modals.single.ms.eq_h1')}</code></li>
                <li><code>{t('modals.single.ms.eq_h2')}</code></li>
              </ul>
            </>
          ) : (
            <>
              <p>{t('modals.multiple.minimal.desc')}</p>
              <h3>{t('modals.math_model')}</h3>
              <p>{t('modals.minimal_desc_base')}</p>
              <ul>
                <li><code>{t('modals.eq_u_minimal')}</code></li>
                <li><code>{t('modals.eq_v_minimal')}</code></li>
                <li><code>{t('modals.eq_w_minimal')}</code></li>
                <li><code>{t('modals.eq_s_minimal')}</code></li>
              </ul>
            </>
          )}
          
          <h3>{t('modals.numerical_method')}</h3>
          <p>{t('modals.single.method')}</p>

          <h3>{t('modals.param_meaning')}</h3>
          <ul>
            {Object.keys(currentParams).map(key => (
               <li key={key}><strong>{t(`params.${key}`) || key}:</strong> {key}</li>
            ))}
          </ul>
        </div>
      </Modal>
    </div>
  );
};

export default MultipleStimuliPage;