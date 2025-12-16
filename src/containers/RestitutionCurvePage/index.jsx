import { useState, useEffect, useCallback } from 'react';
import Chart from '../../components/Chart';
import Input from '../../components/Input';
import Button from '../../components/Button';
import RestitutionChart from '../../components/RestitutionChart';
import Modal from '../../components/Modal'; 
import RestitutionWorker from '../../simulation_restitution.worker.js?worker';
import MMSWorker from '../../simulation_mms_restitution_alt.worker.js?worker';
import DynamicWorker from '../../simulation_dynamic_protocol1.worker.js?worker';
import MinimalWorker from '../../simulation_minimal_restitution.worker.js?worker';
import { useTranslation } from 'react-i18next';
import './styles.css';

// Valores padrão iniciais do Minimal Model
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

const RestitutionCurvePage = ({ onBack }) => {
  const { t } = useTranslation();
  const [data, setData] = useState([]);
  const [restitutionData, setRestitutionData] = useState([]);
  const [analyticalData, setAnalyticalData] = useState([]);
  const [worker, setWorker] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showTimeSeries, setShowTimeSeries] = useState(false);
  const [selectedModel, setSelectedModel] = useState('minimal');
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false); 
  const [minimalCustomParams, setMinimalCustomParams] = useState(DEFAULT_MINIMAL_PARAMS);

  // Parâmetros editáveis para cada modelo
  const [editableParams, setEditableParams] = useState({
    // Parâmetros para o modelo S1S2
    s1s2: {
      BCL_S1: 250, 
      BCL_S2_inicial: 200, 
      BCL_S2_final: 100, 
      delta_CL: 10, 
      tau_in: 0.3, 
      tau_out: 6.0, 
      tau_open: 120.0, 
      tau_close: 150.0, 
      v_gate: 0.13, 
      inicio: 5.0, 
      duracao: 1.0, 
      amplitude: 1.0, 
      dt: 0.1, 
      v_inicial: 0.0, 
      h_inicial: 1.0, 
      num_estimulos_s1: 8, 
      downsamplingFactor: 50, 
    },
    // Parâmetros para o modelo MMS
    mms: {
      BCL_S1: 1000,
      BCL_S2_inicial: 900,
      BCL_S2_final: 200,
      delta_CL: 20,
      tau_in: 0.3, 
      tau_out: 6.0,
      tau_open: 120.0,
      tau_close: 150.0,
      v_gate: 0.13,
      inicio: 5.0,
      duracao: 1.0,
      amplitude: 1.0,
      dt: 0.1,
      v_inicial: 0.0,
      h_inicial: 1.0,
      num_estimulos_s1: 8,
      downsamplingFactor: 1000,
    },
    // Parâmetros para o modelo Dinâmico
    dynamic: {
      CI1: 500, 
      CI0: 250, 
      CIinc: 10, 
      nbeats: 5, 
      tau_in: 0.3,
      tau_out: 6.0,
      tau_open: 120.0,
      tau_close: 150.0,
      v_gate: 0.13,
      inicio: 5.0,
      duracao: 1.0,
      amplitude: 1.0,
      dt: 0.1,
      v_inicial: 0.0,
      h_inicial: 1.0,
      downsamplingFactor: 50,
    },
    // Parâmetros para o Minimal Model
    minimal: {
      cellType: 'epi',
      BCL_S1: 600,
      BCL_S2_inicial: 500,
      BCL_S2_final: 200,
      delta_CL: 10,
      inicio: 10.0,
      duracao: 1.0,
      amplitude: 1.0,
      dt: 0.1,
      num_estimulos_s1: 8,
      downsamplingFactor: 100
    }
  });

  // Função para calcular a curva analítica
  const calculateAnalyticalCurve = useCallback((simulatedData) => {
    if (!simulatedData || simulatedData.length === 0) {
      setAnalyticalData([]);
      return;
    }

    if (selectedModel === 'minimal') {
      setAnalyticalData([]); // Sem solução analítica simples para o minimal
      return;
    }

    let analyticalPoints = [];
    const currentParams = editableParams[selectedModel];
    const { tau_out, tau_in, tau_close, tau_open, v_gate } = currentParams;

    if (selectedModel === 'mms') {
      // Calculo analitico do modelo MMS
      const h_mms_min = Math.pow(1 + (tau_out / (4 * tau_in)) * Math.pow(1 - v_gate, 2), -1);

      analyticalPoints = simulatedData.map(point => {
        const di = point.bcl; 
        const analyticalApd = tau_close * Math.log((1 - (1 - h_mms_min) * Math.exp(-di / tau_open)) / h_mms_min);
        if (analyticalApd && analyticalApd > 0) {
          return { bcl: di, apd: analyticalApd };
        }
        return null;
      }).filter(Boolean); 

    } else if (selectedModel === 's1s2' || selectedModel === 'dynamic') {
      // Calculo analitico do modelo MS padrão
      const h_min = (4 * tau_in) / tau_out;

      analyticalPoints = simulatedData.map(point => {
        const di = point.bcl; 

        const numerator = 1 - (1 - h_min) * Math.exp(-di / tau_open);
        const analyticalApd = tau_close * Math.log(numerator / h_min);
        
        if (analyticalApd && analyticalApd > 0) {
          return { bcl: di, apd: analyticalApd };
        }
        return null;
      }).filter(Boolean); 
    }

    setAnalyticalData(analyticalPoints); 
  }, [editableParams, selectedModel]);


  useEffect(() => {
    let simulationWorker;

    // Seleciona o worker baseado no modelo escolhido
    if (selectedModel === 's1s2') {
      simulationWorker = new RestitutionWorker(); 
    } else if (selectedModel === 'mms') {
      simulationWorker = new MMSWorker();
    } else if (selectedModel === 'minimal') {
      simulationWorker = new MinimalWorker();
    } else {
      simulationWorker = new DynamicWorker();
    }

    setWorker(simulationWorker);

    // Configura o listener para receber mensagens do worker
    simulationWorker.onmessage = (e) => {
      const { timeSeriesData, restitutionData } = e.data;
      if (timeSeriesData) {
        setData(timeSeriesData);
      }
      setRestitutionData(restitutionData);
      // Calcula a curva analítica
      calculateAnalyticalCurve(restitutionData); 
      setLoading(false);
    };

    // Limpa o worker 
    return () => {
      simulationWorker.terminate();
    };
  }, [selectedModel, calculateAnalyticalCurve]); 

  //  função para lidar com mudanças nos inputs
  const handleChange = useCallback((e, name) => {
    const value = name === 'cellType' ? e.target.value : parseFloat(e.target.value);
    setEditableParams((prev) => ({
      ...prev,
      [selectedModel]: {
        ...prev[selectedModel],
        [name]: value
      }
    }));
  }, [selectedModel]);

  // Função para lidar com mudanças nos parâmetros de celula
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

  // Função para iniciar a simulação
  const handleSimularClick = useCallback(() => {
    if (worker) {
      setLoading(true);
      setData([]);
      setRestitutionData([]);
      setAnalyticalData([]);
      
      const payload = { ...editableParams[selectedModel] };
      if (selectedModel === 'minimal') {
        payload.minimalCellParams = minimalCustomParams;
      }
      
      worker.postMessage(payload);
    }
  }, [worker, editableParams, selectedModel, minimalCustomParams]);

  // Função para renderizar o conteúdo do modal de informações
  const renderInfoModalContent = () => {
    const modelKey = selectedModel; // seletor do modelo
    const steps = t(`modals.restitution.${modelKey}.steps`, { returnObjects: true });
    
    // Lista de parâmetros relevantes para exibir no modal
    const currentParamsList = Object.keys(editableParams[selectedModel]);

    return (
      <div className="info-modal-content">
        <h2>{t(`modals.restitution.${modelKey}.title`)}</h2>
        
        {/*O que é a curva */}
        <h3>{t('modals.restitution.what_is')}</h3>
        <p>{t('modals.restitution.what_is_desc')}</p>
        
        <h3>{t('modals.restitution.measuring')}</h3>
        <ul>
          <li>{t('modals.restitution.apd_def')}</li>
          <li>{t('modals.restitution.di_def')}</li>
        </ul>
        
        <h3>{t('modals.protocol')}</h3>
        <p>{t(`modals.restitution.${modelKey}.desc`)}</p>
        <ol>
          {Array.isArray(steps) && steps.map((step, index) => (
            <li key={index}>{step}</li>
          ))}
        </ol>

        <h3>{t('modals.math_model')}</h3>
        
        {/* Para o minimal model */}
        {selectedModel === 'minimal' ? (
          <>
            <ul>
              <li><code>{t('modals.restitution.minimal.eq_u')}</code></li>
              <li><code>{t('modals.restitution.minimal.eq_v')}</code></li>
              <li><code>{t('modals.restitution.minimal.eq_w')}</code></li>
              <li><code>{t('modals.restitution.minimal.eq_s')}</code></li>
            </ul>
            <p><strong>{t('modals.restitution.minimal.vars')}</strong></p>
            <p>{t('modals.restitution.minimal.currents')}</p>
          </>
        ) : (
          <>
            <p>
              <code>{t(`modals.restitution.${modelKey}.eq_v`)}</code>
            </p>
            <p>
              {t(`modals.restitution.${modelKey}.eq_h`)}
            </p>
          </>
        )}

        <h3>{t('modals.numerical_method')}</h3>
        <p>{t(`modals.restitution.${modelKey}.method`)}</p>
        <h3>{t('modals.param_meaning')}</h3>
        <ul>
          {currentParamsList.map((param) => (
            <li key={param}>
              <strong>{param}:</strong> {t(`params.${param}`)}
            </li>
          ))}
        </ul>
      </div>
    );
  };
  
  // Parâmetros atuais baseados no modelo selecionado
  const currentParams = editableParams[selectedModel];

  // Renderiza a página
  return (
    <div className="page-container">
      <Button onClick={onBack}>{t('common.back')}</Button>
      <h1>{t('home.models.restitution_curve.title')}</h1>

      <div className="params-container">
        <div className="input-container">
          <label>{t('common.select_model')}</label>
          <select value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)}>
            <option value="minimal">{t('modals.restitution.minimal.title')}</option>
            <option value="s1s2">{t('modals.restitution.s1s2.title')}</option>
            <option value="mms">{t('modals.restitution.mms.title')}</option>
            <option value="dynamic">{t('modals.restitution.dynamic.title')}</option>
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
            label={t(`params.${key}`)}
            value={currentParams[key]}
            onChange={(e) => handleChange(e, key)}
          />
        ))}
      </div>

      {/*Parâmetros de celula*/}
      {selectedModel === 'minimal' && (
        <div className="params-section">
            <h3 style={{marginTop: '20px'}}>Parâmetros da Célula ({t(`params.${currentParams.cellType}`)})</h3>
            <div className="params-container">
                {Object.keys(minimalCustomParams[currentParams.cellType]).map(key => (
                    <Input 
                        key={key}
                        label={key}
                        value={minimalCustomParams[currentParams.cellType][key]}
                        onChange={(e) => handleMinimalCustomChange(key, e.target.value)}
                    />
                ))}
            </div>
        </div>
      )}

      <div className="button-container">
        <Button onClick={handleSimularClick} disabled={loading}>
          {loading ? t('common.simulating') : t('common.simulate')}
        </Button>
      </div>

      <div className="checkbox-container">
        <input 
          type="checkbox"
          id="showTimeSeries"
          checked={showTimeSeries}
          onChange={() => setShowTimeSeries(!showTimeSeries)}
        />
        <label htmlFor="showTimeSeries">{t('common.show_stimuli')}</label>
      </div>

      <RestitutionChart data={restitutionData} analyticalData={analyticalData} />

      {showTimeSeries && (
        <div>
          <h2>{t('common.stimuli')}</h2>
          <Chart data={data} />
        </div>
      )}

      {/* Botão e Modal de Informações */}
      <div style={{ marginTop: '20px' }}>
        <Button onClick={() => setIsInfoModalOpen(true)}>
          {t('common.more_info')}
        </Button>
      </div>

      <Modal isOpen={isInfoModalOpen} onClose={() => setIsInfoModalOpen(false)}>
        {renderInfoModalContent()}
      </Modal>
    </div>
  );
};

export default RestitutionCurvePage;