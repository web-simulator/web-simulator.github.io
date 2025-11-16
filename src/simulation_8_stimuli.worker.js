function estimulo_periodico(tempo_atual, amplitude, duracao, inicio, BCL, num_estimulos) {
  for (let i = 0; i < num_estimulos; i++) {
    const inicio_pulso = inicio + i * BCL; // Calcula o início de cada pulso
    // Se o tempo atual estiver dentro da janela de um pulso, retorna a amplitude
    if (tempo_atual >= inicio_pulso && tempo_atual < inicio_pulso + duracao) {
      return amplitude;
    }
  }
  return 0.0; // Retorna 0 se não houver estímulo no tempo atual
}

// Handler principal que executa a simulação
self.onmessage = (e) => {
  const params = e.data;
  const {
    despolarização, repolarização, recuperação, inativação, gate, dt,
    v_inicial, h_inicial, inicio, duração, amplitude, BCL,
    num_estimulos, downsamplingFactor,
  } = params;

  // Calcula o tempo total e o número de passos da simulação
  const tempo_total = inicio + num_estimulos * BCL + 50;
  const passos = parseInt(tempo_total / dt, 10);

  // Inicializa os arrays de resultados
  const tempo = new Array(passos);
  const v = new Array(passos);
  const h = new Array(passos);

  // Define as condições iniciais
  v[0] = v_inicial;
  h[0] = h_inicial;
  tempo[0] = 0;

  // Loop principal da simulação
  for (let i = 1; i < passos; i++) {
    tempo[i] = i * dt;
    const t = tempo[i];

    // Verifica se há estímulo a ser aplicado neste passo de tempo
    const estimulo = estimulo_periodico(t, amplitude, duração, inicio, BCL, num_estimulos);
    
    // Pega os valores do passo anterior.
    const v_prev = v[i - 1];
    const h_prev = h[i - 1];
    
    // Euler Explícito para v
    const J_entrada = (h_prev * v_prev ** 2 * (1 - v_prev)) / despolarização;
    const J_saida = -v_prev / repolarização;
    const dv_dt = J_entrada + J_saida + estimulo;

    const v_next = v_prev + dv_dt * dt;

    // Rush-Larsen para h
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

    // Atualiza os arrays de resultado, garantindo que os valores fiquem entre 0 e 1
    v[i] = Math.max(0.0, Math.min(1.0, v_next));
    h[i] = Math.max(0.0, Math.min(1.0, h_next));
  }

  // Reduz a quantidade de pontos para otimizar a renderização do gráfico
  const sampledData = [];
  for (let i = 0; i < passos; i += downsamplingFactor) {
    if (tempo[i] !== undefined) {
      sampledData.push({ tempo: tempo[i].toFixed(2), v: v[i], h: h[i] });
    }
  }

  // Envia os dados processados de volta para a página principal
  self.postMessage(sampledData);
};