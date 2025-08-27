import { useState, useEffect, useCallback } from 'react';
import RestitutionChart from '../../components/RestitutionChart';
import Input from '../../components/Input';
import Button from '../../components/Button';
import SimulationWorker from '../../simulation_mms_restitution_alt.worker.js?worker';
import './styles.css';

const MMSAlternativeCurvePage = ({ onBack }) => {
  const [restitutionData, setRestitutionData] = useState([]);
  const [analyticalData, setAnalyticalData] = useState([]);
  const [worker, setWorker] = useState(null);
  const [loading, setLoading] = useState(false);

  /*
  // Parâmetros da simulação que o usuário pode alterar (VERSÃO ANTIGA)
  const [simParams, setSimParams] = useState({
    BCL_S1: 250,
    BCL_S2_inicial: 200,
    BCL_S2_final: 100,
    delta_CL: 1,
  });

  // Parâmetros do modelo que o usuário pode alterar (VERSÃO ANTIGA)
  const [modelParams, setModelParams] = useState({
    tau_in: 0.1,
    tau_out: 9.0,
    tau_open: 100.0,
    tau_close: 120.0,
    v_gate: 0.13,
    inicio: 5.0,
    duracao: 1.0,
    amplitude: 1.0,
  });

  // Parâmetros fixos (VERSÃO ANTIGA)
  const [fixedParams] = useState({
    dt: 0.1,
    v_inicial: 0.0,
    h_inicial: 1.0,
    num_estimulos_s1: 8,
    downsamplingFactor: 3000,
  });
  */

  // Todos os parâmetros agora são editáveis (VERSÃO ATUAL)
  const [editableParams, setEditableParams] = useState({
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
  });

  //Função para calcular a curva analitica
  const calculateAnalyticalCurve = useCallback((simulatedData) => {
    if (!simulatedData || simulatedData.length === 0) {
      setAnalyticalData([]);
      return;
    }

    const { tau_out, tau_in, v_gate, tau_close, tau_open } = editableParams; // Usa o estado unificado

    const h_mms_min = Math.pow(1 + (tau_out / (4 * tau_in)) * Math.pow(1 - v_gate, 2), -1);

    const analyticalPoints = simulatedData.map(point => {
      const di = point.bcl;
      const analyticalApd = tau_close * Math.log((1 - (1 - h_mms_min) * Math.exp(-di / tau_open)) / h_mms_min);
      if (analyticalApd && analyticalApd > 0) {
        return { bcl: di, apd: analyticalApd };
      }
      return null;
    }).filter(Boolean);

    setAnalyticalData(analyticalPoints);
  }, [editableParams]); // Usa os novos parâmetros

  useEffect(() => {
    const simulationWorker = new SimulationWorker();
    setWorker(simulationWorker);

    simulationWorker.onmessage = (e) => {
      const { restitutionData } = e.data;
      setRestitutionData(restitutionData);
      calculateAnalyticalCurve(restitutionData);
      setLoading(false);
    };

    return () => {
      simulationWorker.terminate();
    };
  }, [calculateAnalyticalCurve]);

  /*
  // Atualiza os parâmetros da simulação (VERSÃO ANTIGA)
  const handleChange = useCallback((e, name) => {
    const value = parseFloat(e.target.value);
    setSimParams((prev) => ({ ...prev, [name]: value }));
  }, []);

  // Atualiza os parâmetros do modelo (VERSÃO ANTIGA)
  const handleModelChange = useCallback((e, name) => {
    const value = parseFloat(e.target.value);
    setModelParams((prev) => ({ ...prev, [name]: value }));
  }, []);

  // Função chamada ao clicar no botão Simular (VERSÃO ANTIGA)
  const handleSimularClick = useCallback(() => {
    if (worker) {
      setLoading(true);
      setRestitutionData([]);
      setAnalyticalData([]);
      const allParams = { ...simParams, ...modelParams, ...fixedParams };
      worker.postMessage(allParams);
    }
  }, [worker, simParams, modelParams, fixedParams]);
  */

  // Função única para lidar com as alterações (VERSÃO ATUAL)
  const handleChange = useCallback((e, name) => {
    const value = parseFloat(e.target.value);
    setEditableParams((prev) => ({ ...prev, [name]: value }));
  }, []);

  // Função de simulação simplificada (VERSÃO ATUAL)
  const handleSimularClick = useCallback(() => {
    if (worker) {
      setLoading(true);
      setRestitutionData([]);
      setAnalyticalData([]);
      worker.postMessage(editableParams);
    }
  }, [worker, editableParams]);

  return (
    <div className="page-container">
      <Button onClick={onBack}>Voltar para Home</Button>
      <h1>Curva de Restituição (MMS) - Gráfico Direto</h1>

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

      <div className="button-container">
        <Button onClick={handleSimularClick} disabled={loading}>
          {loading ? 'Simulando...' : 'Simular'}
        </Button>
      </div>

      <RestitutionChart data={restitutionData} analyticalData={analyticalData} />
    </div>
  );
};

export default MMSAlternativeCurvePage;