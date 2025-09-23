import { useState, useEffect, useCallback } from 'react';
import Chart from '../../components/Chart';
import Input from '../../components/Input';
import Button from '../../components/Button';
import RestitutionChart from '../../components/RestitutionChart';
import RestitutionWorker from '../../simulation_restitution.worker.js?worker';
import MMSWorker from '../../simulation_mms_restitution_alt.worker.js?worker';
import DynamicWorker from '../../simulation_dynamic_protocol1.worker.js?worker';
import './styles.css';

const RestitutionCurvePage = ({ onBack }) => {
  const [data, setData] = useState([]);
  const [restitutionData, setRestitutionData] = useState([]);
  const [analyticalData, setAnalyticalData] = useState([]);
  const [worker, setWorker] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showTimeSeries, setShowTimeSeries] = useState(false);
  const [selectedModel, setSelectedModel] = useState('s1s2'); // opcões: 's1s2', 'mms', 'dynamic'

  // Parâmetros editáveis para cada modelo

  const [editableParams, setEditableParams] = useState({
    // Parâmetros para o modelo S1S2
    s1s2: {
      BCL_S1: 250, // BCL do estímulo S1
      BCL_S2_inicial: 200, // BCL inicial do estímulo S2
      BCL_S2_final: 100, // BCL final do estímulo S2
      delta_CL: 10, // Decremento do BCL do estímulo S2
      tau_in: 0.3, // Constante de tempo de entrada
      tau_out: 6.0, // Constante de tempo de saída
      tau_open: 120.0, // Constante de tempo de abertura
      tau_close: 150.0, // Constante de tempo de fechamento
      v_gate: 0.13, // Valor de gate
      inicio: 5.0, // Início do estímulo
      duracao: 1.0, // Duração do estímulo
      amplitude: 1.0, // Amplitude do estímulo
      dt: 0.1, // Passo de tempo
      v_inicial: 0.0, // Potencial inicial
      h_inicial: 1.0, // Variável de porta inicial
      num_estimulos_s1: 8, // Número de estímulos S1
      downsamplingFactor: 50, // Fator de downsampling
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
      CI1: 500, // Corrente de entrada 1
      CI0: 250, //  Corrente de entrada 0
      CIinc: 10, // Incremento da corrente de entrada
      nbeats: 5, // Número de batimentos
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
    }
  });

  // Função para calcular a curva analítica para o modelo MMS
  const calculateAnalyticalCurve = useCallback((simulatedData) => {
    if (!simulatedData || simulatedData.length === 0 || selectedModel !== 'mms') {
      setAnalyticalData([]);
      return;
    }

    // Extrai os parâmetros necessários
    const { tau_out, tau_in, v_gate, tau_close, tau_open } = editableParams.mms;

    // Cálculo da curva analítica
    const h_mms_min = Math.pow(1 + (tau_out / (4 * tau_in)) * Math.pow(1 - v_gate, 2), -1);

    // Cálculo dos pontos analíticos
    const analyticalPoints = simulatedData.map(point => {
      const di = point.bcl;
      const analyticalApd = tau_close * Math.log((1 - (1 - h_mms_min) * Math.exp(-di / tau_open)) / h_mms_min);
      if (analyticalApd && analyticalApd > 0) { // Garantir que apd seja positivo
        return { bcl: di, apd: analyticalApd };
      }
      return null;
    }).filter(Boolean); // Remove pontos nulos

    setAnalyticalData(analyticalPoints); 
  }, [editableParams.mms, selectedModel]);

  useEffect(() => {
    let simulationWorker;

    // Seleciona o worker baseado no modelo escolhido
    if (selectedModel === 's1s2') {
      simulationWorker = new RestitutionWorker(); 
    } else if (selectedModel === 'mms') {
      simulationWorker = new MMSWorker();
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
    const value = parseFloat(e.target.value);
    setEditableParams((prev) => ({
      ...prev,
      [selectedModel]: {
        ...prev[selectedModel],
        [name]: value
      }
    }));
  }, [selectedModel]);

  // Função para iniciar a simulação
  const handleSimularClick = useCallback(() => {
    if (worker) {
      setLoading(true);
      setData([]);
      setRestitutionData([]);
      setAnalyticalData([]);
      worker.postMessage(editableParams[selectedModel]);
    }
  }, [worker, editableParams, selectedModel]);
  
  // Parâmetros atuais baseados no modelo selecionado
  const currentParams = editableParams[selectedModel];

  // Renderiza a página
  return (
    <div className="page-container">
      <Button onClick={onBack}>Voltar para Home</Button>
      <h1>Curva de Restituição</h1>

      <div className="params-container">
        <div className="input-container">
          <label>Selecione o Modelo</label>
          <select value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)}>
            <option value="s1s2">S1-S2</option>
            <option value="mms">Mitchel Schaeffer Modificado</option>
            <option value="dynamic">Dinâmico</option>
          </select>
        </div>
      </div>
      
      <h2>Parâmetros da Simulação</h2>
      <div className="params-container">
        {Object.keys(currentParams).map((key) => (
          <Input
            key={key}
            label={key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ')}
            value={currentParams[key]}
            onChange={(e) => handleChange(e, key)}
          />
        ))}
      </div>

      <div className="button-container">
        <Button onClick={handleSimularClick} disabled={loading}>
          {loading ? 'Simulando...' : 'Simular'}
        </Button>
      </div>

      <div className="checkbox-container">
        <input 
          type="checkbox"
          id="showTimeSeries"
          checked={showTimeSeries}
          onChange={() => setShowTimeSeries(!showTimeSeries)}
        />
        <label htmlFor="showTimeSeries">Mostrar estímulos</label>
      </div>

      <RestitutionChart data={restitutionData} analyticalData={analyticalData} />

      {showTimeSeries && (
        <div>
          <h2>Estímulos</h2>
          <Chart data={data} />
        </div>
      )}
    </div>
  );
};

export default RestitutionCurvePage;