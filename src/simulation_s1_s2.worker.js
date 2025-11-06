// Função para aplicar estímulos S1-S2
function aplicarEstimulo(tempo_atual, amplitude, duracao, inicio, BCL_S1, intervalo_S2, num_estimulos_s1) {
  // Aplica os 8 estímulos S1
  for (let i = 0; i < num_estimulos_s1; i++) {
    const inicio_pulso = inicio + i * BCL_S1;
    if (tempo_atual >= inicio_pulso && tempo_atual < inicio_pulso + duracao) {
      return amplitude;
    }
  }

  // Aplica o estímulo S2
  const inicio_s2 = inicio + (num_estimulos_s1 - 1) * BCL_S1 + intervalo_S2;
  if (tempo_atual >= inicio_s2 && tempo_atual < inicio_s2 + duracao) {
    return amplitude;
  }

  return 0.0;
}

// Parâmetros da simulação para o worker
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
    BCL_S1,
    intervalo_S2,
    num_estimulos_s1,
    downsamplingFactor,
  } = params;

  // Tempo total da simulação
  const tempo_total = inicio + (num_estimulos_s1 - 1) * BCL_S1 + intervalo_S2 + 2 * BCL_S1;
  // Número total de passos
  const passos = parseInt(tempo_total / dt, 10);

  const tempo = new Array(passos); // tempo
  const v = new Array(passos); // voltagem
  const h = new Array(passos); // gate

  // Condições iniciais
  v[0] = v_inicial;
  h[0] = h_inicial;
  tempo[0] = 0;

  // RK4
  for (let i = 1; i < passos; i++) {
    tempo[i] = i * dt;
    const t = tempo[i];

    // Determina se há estímulo aplicado neste instante
    const estimulo = aplicarEstimulo(t, amplitude, duração, inicio, BCL_S1, intervalo_S2, num_estimulos_s1);

    const v_prev = v[i - 1];
    const h_prev = h[i - 1];

    // Funções de derivada 
    const f_v = (vv, hh) => {
      const J_entrada = (hh * vv ** 2 * (1 - vv)) / despolarização;
      const J_saida = -vv / repolarização;
      return J_entrada + J_saida + estimulo;
    };

    const f_h = (vv, hh) => {
      if (vv < gate) {
        return (1 - hh) / recuperação; // Recuperação lenta
      } else {
        return -hh / inativação; // Inativação rápida
      }
    };
    
    // K1
    const k1_v = dt * f_v(v_prev, h_prev);
    const k1_h = dt * f_h(v_prev, h_prev);

    // K2
    const k2_v = dt * f_v(v_prev + 0.5 * k1_v, h_prev + 0.5 * k1_h);
    const k2_h = dt * f_h(v_prev + 0.5 * k1_v, h_prev + 0.5 * k1_h);

    // K3
    const k3_v = dt * f_v(v_prev + 0.5 * k2_v, h_prev + 0.5 * k2_h);
    const k3_h = dt * f_h(v_prev + 0.5 * k2_v, h_prev + 0.5 * k2_h);

    // K4
    const k4_v = dt * f_v(v_prev + k3_v, h_prev + k3_h);
    const k4_h = dt * f_h(v_prev + k3_v, h_prev + k3_h);

    // Próximo valor
    const v_next = v_prev + (1.0 / 6.0) * (k1_v + 2 * k2_v + 2 * k3_v + k4_v);
    const h_next = h_prev + (1.0 / 6.0) * (k1_h + 2 * k2_h + 2 * k3_h + k4_h);
    
    // Atualiza as variáveis e mantém no intervalo 0,1
    v[i] = Math.max(0.0, Math.min(1.0, v_next));
    h[i] = Math.max(0.0, Math.min(1.0, h_next));
  }

  // Reduz a quantidade de pontos para otimização
  const sampledData = [];
  for (let i = 0; i < passos; i += downsamplingFactor) {
    sampledData.push({ tempo: tempo[i]?.toFixed(2), v: v[i], h: h[i] });
  }

  // Envia os dados para a página principal
  self.postMessage(sampledData);
};