self.onmessage = (e) => {
  const params = e.data;
  // Parametros
  let {
    k,
    Tau_in,
    Tau_out,
    Tau_open,
    Tau_close,
    gate,
    L,
    dx,
    dt,
    totalTime,
    downsamplingFactor,
    inicio,
    duracao,
    amplitude,
    posição_do_estímulo,
    tamanho_do_estímulo, 
    num_estimulos,
    BCL
  } = params;

  // Verifica e ajusta a condição de estabilidade de CFL
  const cfl_limit = (dx * dx) / (2 * k);
  if (dt > cfl_limit) {
    dt = cfl_limit * 0.9; // Ajusta dt para um valor seguro
  }

  const N = Math.floor(L / dx); // Calcula o número de pontos na grade 

  // Inicializa os arrays de v e h
  let v = new Array(N).fill(0);
  let h = new Array(N).fill(1);
  
  // Função para aplicar estímulos periódicos
  function aplicarEstimuloPeriodico(tempo_atual, amplitude, duracao, inicio, BCL, num_estimulos) {
      for (let i = 0; i < num_estimulos; i++) {
          const inicio_pulso = inicio + i * BCL;
          if (tempo_atual >= inicio_pulso && tempo_atual < inicio_pulso + duracao) {
              return amplitude;
          }
      }
      return 0.0;
  }
  
  const steps = Math.floor(totalTime / dt); // Calcula o número total de passos na simulação
  const outputData = []; // Array para armazenar os resultados.

  // Índices para o estímulo
  const stimulus_center_index = Math.floor(posição_do_estímulo / dx);
  const stimulus_half_size_index = Math.floor(tamanho_do_estímulo / (2 * dx));
  const stim_start_idx = Math.max(1, stimulus_center_index - stimulus_half_size_index);
  const stim_end_idx = Math.min(N - 2, stimulus_center_index + stimulus_half_size_index);

  // Loop principal 
  for (let t = 0; t < steps; t++) {
    // Aplica o estímulo no tempo atual
    const current_stimulus = aplicarEstimuloPeriodico(t * dt, amplitude, duracao, inicio, BCL, num_estimulos);

    // Cria uma cópia dos valores do passo de tempo anterior
    const v_prev = [...v];
    const h_prev = [...h];
    
    // Loop espacial
    for (let i = 1; i < N - 1; i++) {
        const vp = v_prev[i];
        const hp = h_prev[i];

        // Rush-Larsen para h
        let alpha_h, beta_h;
        if (vp < gate) {
          alpha_h = 1.0 / Tau_open;
          beta_h = 0.0;
        } else {
          alpha_h = 0.0;
          beta_h = 1.0 / Tau_close;
        }

        const sum_ab = alpha_h + beta_h;
        if (sum_ab > 0) {
          const h_inf = alpha_h / sum_ab;
          const h_exp = Math.exp(-sum_ab * dt);
          h[i] = h_inf + (hp - h_inf) * h_exp;
        }

        // Euler para v
        const diffusion = k * (v_prev[i + 1] - 2 * vp + v_prev[i - 1]) / (dx * dx);
        const J_entrada = (hp * vp ** 2 * (1 - vp)) / Tau_in;
        const J_saida = -vp / Tau_out;
        const reaction = J_entrada + J_saida;

        // Aplica o estímulo na região
        let stimulus = 0;
        if (i >= stim_start_idx && i <= stim_end_idx) {
            stimulus = current_stimulus;
        }

        v[i] = vp + (diffusion + reaction + stimulus) * dt;

        // Garante que os valores fiquem entre 0 e 1
        v[i] = Math.max(0.0, Math.min(1.0, v[i]));
        h[i] = Math.max(0.0, Math.min(1.0, h[i]));
    }
    
    // Aplica as condições de contorno de Neumann nas bordas do array final
    v[0] = v[1];
    v[N - 1] = v[N - 2];
    h[0] = h[1];
    h[N - 1] = h[N - 2];

    // Salva os dados em intervalos definidos pelo downsamplingFactor
    if (t % downsamplingFactor === 0) {
      const snapshot = v.map((v_val, index) => ({
        x: index * dx,
        v: v_val,
        h: h[index],
        tempo: (t * dt).toFixed(2)
      }));
      outputData.push({
        time: (t * dt).toFixed(2),
        data: snapshot
      });
    }
  }

  // Envia os dados para a thread principal.
  self.postMessage(outputData);
};