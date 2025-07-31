// src/simulation.worker.js

self.onmessage = (e) => {
  const params = e.data;
  const {
    despolarização,
    repolarização,
    recuperação,
    inativação,
    gate,
    dt,
    tempo_total,
    v_inicial,
    h_inicial,
    inicio,
    duração,
    amplitude,
    downsamplingFactor, // Novo parâmetro para controlar o downsampling
  } = params;

  const passos = parseInt(tempo_total / dt, 10);
  const tempo = new Array(passos);
  const v = new Array(passos);
  const h = new Array(passos);

  v[0] = v_inicial;
  h[0] = h_inicial;
  tempo[0] = 0;

  for (let i = 1; i < passos; i++) {
    tempo[i] = i * dt;
    const t = tempo[i];
    let estimulo = 0;
    if (t >= inicio && t < inicio + duração) {
      estimulo = amplitude;
    }

    const J_entrada = (h[i - 1] * v[i - 1] ** 2 * (1 - v[i - 1])) / despolarização;
    const J_saida = -v[i - 1] / repolarização;
    const dv = J_entrada + J_saida + estimulo;

    let dh;
    if (v[i - 1] < gate) {
      dh = (1 - h[i - 1]) / recuperação;
    } else {
      dh = -h[i - 1] / inativação;
    }

    v[i] = v[i - 1] + dt * dv;
    h[i] = h[i - 1] + dt * dh;

    v[i] = Math.max(0.0, Math.min(1.0, v[i]));
    h[i] = Math.max(0.0, Math.min(1.0, h[i]));
  }

  // Lógica de Downsampling
  const sampledData = [];
  for (let i = 0; i < passos; i += downsamplingFactor) {
    sampledData.push({ tempo: tempo[i].toFixed(2), v: v[i], h: h[i] });
  }

  // Envia apenas os dados subamostrados
  self.postMessage(sampledData);
};