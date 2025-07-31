// src/simulation_8_stimuli.worker.js

function estimulo_periodico(tempo_atual, amplitude, duracao, inicio, BCL, num_estimulos) {
  for (let i = 0; i < num_estimulos; i++) {
    const inicio_pulso = inicio + i * BCL;
    if (tempo_atual >= inicio_pulso && tempo_atual < inicio_pulso + duracao) {
      return amplitude;
    }
  }
  return 0.0;
}

self.onmessage = (e) => {
  const params = e.data;
  const {
    despolarização,
    repolarização,
    recuperação,
    inativação,
    gate,
    dt,
    v_inicial,
    h_inicial,
    inicio,
    duração,
    amplitude,
    BCL,
    num_estimulos,
    downsamplingFactor,
  } = params;

  // O tempo total é calculado dinamicamente
  const tempo_total = inicio + num_estimulos * BCL + 50;
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
    const estimulo = estimulo_periodico(t, amplitude, duração, inicio, BCL, num_estimulos);

    const J_entrada = (h[i - 1] * v[i - 1] ** 2 * (1 - v[i - 1])) / despolarização;
    const J_saida = -v[i - 1] / repolarização;
    const dv = J_entrada + J_saida + estimulo;

    let dh;
    if (v[i - 1] < gate) {
      dh = (1 - h[i - 1]) / recuperação;
    } else {
      dh = -h[i - 1] / inativação;
    }

    v[i] = Math.max(0.0, Math.min(1.0, v[i - 1] + dt * dv));
    h[i] = Math.max(0.0, Math.min(1.0, h[i - 1] + dt * dh));
  }

  const sampledData = [];
  for (let i = 0; i < passos; i += downsamplingFactor) {
    sampledData.push({ tempo: tempo[i].toFixed(2), v: v[i], h: h[i] });
  }

  self.postMessage(sampledData);
};