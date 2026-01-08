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

// Cálculo do APD90
function calculateAPD90(trace) {
    if (trace.length === 0) return 0;
    
    let v_peak = -Infinity;
    let v_rest = 0;
    let peakIndex = 0;

    for (let i = 0; i < trace.length; i++) {
        if (trace[i].v > v_peak) {
            v_peak = trace[i].v;
            peakIndex = i;
        }
    }

    if (v_peak < 0.05) return 0;

    const amplitude = v_peak - v_rest;
    const v_90 = v_peak - 0.9 * amplitude;
    
    let t_start = trace[0].t;
    let t_end = trace[trace.length - 1].t;

    // Busca para trás a partir do pico
    for (let i = peakIndex; i >= 0; i--) {
        if (trace[i].v < v_90) {
            t_start = trace[i].t;
            break;
        }
    }

    // Busca para frente a partir do pico
    for (let i = peakIndex; i < trace.length; i++) {
        if (trace[i].v < v_90) {
            t_end = trace[i].t;
            break;
        }
    }

    return t_end - t_start;
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

  // Métricas do último estímulo
  const inicio_s2 = inicio + (num_estimulos_s1 - 1) * BCL_S1 + intervalo_S2;
  let max_dvdt = 0;
  let last_beat_trace = [];

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

    if (t >= inicio_s2) {
        if (dv_dt > max_dvdt) max_dvdt = dv_dt;
        last_beat_trace.push({ t: t, v: v_next });
    }

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

  // Calcula APD
  const apd = calculateAPD90(last_beat_trace);

  // Reduz a quantidade de pontos para otimização
  const sampledData = [];
  for (let i = 0; i < passos; i += downsamplingFactor) {
    sampledData.push({ tempo: tempo[i]?.toFixed(2), v: v[i], h: h[i] });
  }

  // Envia os dados para a página principal
  self.postMessage({
      data: sampledData,
      metrics: {
          dvdtMax: max_dvdt,
          apd: apd
      }
  });
};