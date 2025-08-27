import { useState, useEffect, useCallback } from 'react';
import Chart from '../../components/Chart';
import Input from '../../components/Input';
import Button from '../../components/Button';
import Modal from '../../components/Modal';
import RestitutionChart from '../../components/RestitutionChart';
import SimulationWorker from '../../simulation_mms_restitution.worker.js?worker';
import './styles.css';

const MMSCurvePage = ({ onBack }) => {
  const [data, setData] = useState([]);
  const [restitutionData, setRestitutionData] = useState([]);
  const [worker, setWorker] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

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
    downsamplingFactor: 100
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

  useEffect(() => {
    const simulationWorker = new SimulationWorker();
    setWorker(simulationWorker);

    simulationWorker.onmessage = (e) => {
      const { timeSeriesData, restitutionData } = e.data;
      setData(timeSeriesData);
      setRestitutionData(restitutionData);
      setLoading(false);
    };

    return () => {
      simulationWorker.terminate();
    };
  }, []);

  /*
  // Lida com a alteração dos valores dos inputs (VERSÃO ANTIGA)
  const handleChange = useCallback((e, name) => {
    const value = parseFloat(e.target.value);
    setSimParams((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleModelChange = useCallback((e, name) => {
    const value = parseFloat(e.target.value);
    setModelParams((prev) => ({ ...prev, [name]: value }));
  }, []);
  */
  
  // Função única para lidar com todas as alterações (VERSÃO ATUAL)
  const handleChange = useCallback((e, name) => {
    const value = parseFloat(e.target.value);
    setEditableParams((prev) => ({ ...prev, [name]: value }));
  }, []);
  
  /*
  // Iniciar a simulação (VERSÃO ANTIGA)
  const handleSimularClick = useCallback(() => {
    if (worker) {
      setLoading(true);
      setData([]);
      setRestitutionData([]);
      const allParams = { ...simParams, ...modelParams, ...fixedParams };
      worker.postMessage(allParams);
    }
  }, [worker, simParams, modelParams, fixedParams]);
  */
  
  // Função de simulação simplificada (VERSÃO ATUAL)
  const handleSimularClick = useCallback(() => {
    if (worker) {
      setLoading(true);
      setData([]);
      setRestitutionData([]);
      worker.postMessage(editableParams);
    }
  }, [worker, editableParams]);
  
  return (
    <div className="page-container">
      <Button onClick={onBack}>Voltar para Home</Button>
      <h1>Curva de Restituição (Mitchell-Schaeffer Modificado)</h1>

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
        <Button onClick={() => setIsModalOpen(true)} disabled={restitutionData.length === 0}>
          Curva de Restituição
        </Button>
      </div>

      <Chart data={data} />

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
        <h2>Curva de Restituição</h2>
        <RestitutionChart data={restitutionData} />
      </Modal>
    </div>
  );
};

export default MMSCurvePage;