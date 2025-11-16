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

  // Loop principal (Euler + Rush-Larsen)
  for (let i = 1; i < passos; i++) {
    tempo[i] = i * dt;
    const t = tempo[i];

    // Determina se há estímulo aplicado neste instante
    const estimulo = aplicarEstimulo(t, amplitude, duração, inicio, BCL_S1, intervalo_S2, num_estimulos_s1);

    const v_prev = v[i - 1];
    const h_prev = h[i - 1];

    // Método de Euler Explícito para v
    const J_entrada = (h_prev * v_prev ** 2 * (1 - v_prev)) / despolarização;
    const J_saida = -v_prev / repolarização;
    const dv_dt = J_entrada + J_saida + estimulo;

    const v_next = v_prev + dv_dt * dt;

    // Método de Rush-Larsen para h
    let alpha_h, beta_h;
    if (v_prev < gate) {
      alpha_h = 1.0 / recuperação;
      beta_h = 0.0;
    } else {
      alpha_h = 0.0;
      beta_h = 1.0 / inativação;
    }

    const sum_ab = alpha_h + beta_h;
    let h_next;

    if (sum_ab > 0) {
      const h_inf = alpha_h / sum_ab;
      const h_exp = Math.exp(-sum_ab * dt);
      h_next = h_inf + (h_prev - h_inf) * h_exp;
    } else {
      h_next = h_prev;
    }
    
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