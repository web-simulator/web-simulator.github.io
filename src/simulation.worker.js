// Parâmetros da simulação para o worker
self.onmessage = (e) => {
  const params = e.data;
  const {
    despolarização,       // Ativação do potencial
    repolarização,        // Tepolarização
    recuperação,          // Tempo de recuperação (tau_open)
    inativação,           // Tempo de inativação (tau_close)
    gate,                 // Limite para ativar ou inativar
    dt,                   // Passo de tempo da simulação
    tempo_total,          // Duração total
    v_inicial,            // Condição inicial para v 
    h_inicial,            // Condição inicial para h 
    inicio,               // Tempo de início do estímulo
    duração,              // Duração do estímulo
    amplitude,            // Amplitude do estímulo
    downsamplingFactor,   // Fator para reduzir a quantidade de pontos enviados ao gráfico
  } = params;

  // Número total de passos
  const passos = parseInt(tempo_total / dt, 10);

  const tempo = new Array(passos); // tempo
  const v = new Array(passos); // voltagem
  const h = new Array(passos); //gate

  // Condições iniciais
  v[0] = v_inicial;
  h[0] = h_inicial;
  tempo[0] = 0;

  // Loop principal da simulação (Euler + Rush-Larsen)
  for (let i = 1; i < passos; i++) {
    tempo[i] = i * dt; // Tempo atual
    const t = tempo[i];

    // Determina se há estímulo aplicado neste instante
    let estimulo = 0;
    if (t >= inicio && t < inicio + duração) {
      estimulo = amplitude;
    }

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

    // Evita divisão por zero
    if (sum_ab > 0) {
      const h_inf = alpha_h / sum_ab;
      const h_exp = Math.exp(-sum_ab * dt);
      h_next = h_inf + (h_prev - h_inf) * h_exp;
    } else {
      h_next = h_prev; // Sem mudança
    }

    // Garante que v e h permaneçam entre 0 e 1
    v[i] = Math.max(0.0, Math.min(1.0, v_next));
    h[i] = Math.max(0.0, Math.min(1.0, h_next));
  }

  // Reduz a quantidade de pontos para otimização
  const sampledData = [];
  for (let i = 0; i < passos; i += downsamplingFactor) {
    sampledData.push({ tempo: tempo[i].toFixed(2), v: v[i], h: h[i] });
  }

  // Envia os dados para a página principal
  self.postMessage(sampledData);
};