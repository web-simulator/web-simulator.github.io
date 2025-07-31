
import { useState } from 'react';
import Chart from '../../components/Chart';
import Input from '../../components/Input';
import Button from '../../components/Button';
import './styles.css';

const Home = () => {
  const [data, setData] = useState([]);
  const [params, setParams] = useState({
    tau_entrada: 0.3,
    tau_saida: 6.0,
    tau_aberto: 120.0,
    tau_fechado: 80.0,
    gate: 0.13,
    dt: 0.01,
    tempo_total: 500.0,
    v_inicial: 0.0,
    h_inicial: 1.0,
    t_inicial: 5.0,
    duracao_estimulo: 1.0,
    amplitude_estimulo: 1.0,
  });

  const handleChange = (e, name) => {
    setParams({ ...params, [name]: parseFloat(e.target.value) });
  };

  const simular = () => {
    const {
      tau_entrada,
      tau_saida,
      tau_aberto,
      tau_fechado,
      gate,
      dt,
      tempo_total,
      v_inicial,
      h_inicial,
      t_inicial,
      duracao_estimulo,
      amplitude_estimulo,
    } = params;

    const passos = parseInt(tempo_total / dt, 10);
    const tempo = Array.from({ length: passos }, (_, i) => i * dt);
    const v = new Array(passos).fill(0);
    const h = new Array(passos).fill(0);

    v[0] = v_inicial;
    h[0] = h_inicial;

    for (let i = 1; i < passos; i++) {
      const t = tempo[i];
      let estimulo = 0;
      if (t >= t_inicial && t < t_inicial + duracao_estimulo) {
        estimulo = amplitude_estimulo;
      }

      const J_entrada = (h[i - 1] * v[i - 1] ** 2 * (1 - v[i - 1])) / tau_entrada;
      const J_saida = -v[i - 1] / tau_saida;

      const dv = J_entrada + J_saida + estimulo;

      let dh;
      if (v[i - 1] < gate) {
        dh = (1 - h[i - 1]) / tau_aberto;
      } else {
        dh = -h[i - 1] / tau_fechado;
      }

      v[i] = v[i - 1] + dt * dv;
      h[i] = h[i - 1] + dt * dh;

      v[i] = Math.max(0.0, Math.min(1.0, v[i]));
      h[i] = Math.max(0.0, Math.min(1.0, h[i]));
    }

    const newData = tempo.map((t, i) => ({ tempo: t, v: v[i], h: h[i] }));
    setData(newData);
  };

  return (
    <div className="home-container">
      <h1>Modelo de Mitchell-Schaeffer</h1>
      <div className="params-container">
        {Object.keys(params).map((key) => (
          <Input
            key={key}
            label={key}
            value={params[key]}
            onChange={(e) => handleChange(e, key)}
          />
        ))}
      </div>
      <Button onClick={simular}>Simular</Button>
      <Chart data={data} />
    </div>
  );
};

export default Home;