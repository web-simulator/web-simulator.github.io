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

  // Funções de derivada para o método RK4
  function f_v(vv, hh, i, current_stimulus) {
    // Calcula a difusão do potencial
    const diffusion = k * (vv[i + 1] - 2 * vv[i] + vv[i - 1]) / (dx * dx);
    // Calcula a reação
    const J_entrada = (hh[i] * vv[i] ** 2 * (1 - vv[i])) / Tau_in;
    const J_saida = -vv[i] / Tau_out;
    const reaction = J_entrada + J_saida;

    // Aplica o estímulo apenas na posição definida
    if (i === Math.floor(posição_do_estímulo / dx)) {
        return diffusion + reaction + current_stimulus;
    }

    return diffusion + reaction;
  }

  function f_h(vv, hh, i) {
    // A taxa de mudança de 'h' depende do valor de 'v' em relação ao limiar
    if (vv[i] < gate) {
      return (1 - hh[i]) / Tau_open;
    } else {
      return -hh[i] / Tau_close;
    }
  }

  // Loop principal 
  for (let t = 0; t < steps; t++) {
    // Aplica o estímulo no tempo atual
    const current_stimulus = aplicarEstimuloPeriodico(t * dt, amplitude, duracao, inicio, BCL, num_estimulos);

    // Cria uma cópia dos valores do passo de tempo anterior
    const v_prev = [...v];
    const h_prev = [...h];
    
    // Ks do Runge-Kutta 4
    const k1_v = new Array(N).fill(0);
    const k1_h = new Array(N).fill(0);
    const k2_v = new Array(N).fill(0);
    const k2_h = new Array(N).fill(0);
    const k3_v = new Array(N).fill(0);
    const k3_h = new Array(N).fill(0);
    const k4_v = new Array(N).fill(0);
    const k4_h = new Array(N).fill(0);

    // K1
    for (let i = 1; i < N - 1; i++) {
      k1_v[i] = dt * f_v(v_prev, h_prev, i, current_stimulus);
      k1_h[i] = dt * f_h(v_prev, h_prev, i);
    }

    // K2
    const v_k2 = [...v_prev];
    const h_k2 = [...h_prev];
    for (let i = 1; i < N - 1; i++) {
      v_k2[i] = v_prev[i] + 0.5 * k1_v[i];
      h_k2[i] = h_prev[i] + 0.5 * k1_h[i];
    }
    // Aplica as condições de contorno de Neumann para o cálculo de K2
    v_k2[0] = v_k2[1];
    v_k2[N - 1] = v_k2[N - 2];
    h_k2[0] = h_k2[1];
    h_k2[N - 1] = h_k2[N - 2];
    for (let i = 1; i < N - 1; i++) {
      k2_v[i] = dt * f_v(v_k2, h_k2, i, current_stimulus);
      k2_h[i] = dt * f_h(v_k2, h_k2, i);
    }

    // K3
    const v_k3 = [...v_prev];
    const h_k3 = [...h_prev];
    for (let i = 1; i < N - 1; i++) {
      v_k3[i] = v_prev[i] + 0.5 * k2_v[i];
      h_k3[i] = h_prev[i] + 0.5 * k2_h[i];
    }
    // Aplica as condições de contorno para o cálculo de K3
    v_k3[0] = v_k3[1];
    v_k3[N - 1] = v_k3[N - 2];
    h_k3[0] = h_k3[1];
    h_k3[N - 1] = h_k3[N - 2];
    for (let i = 1; i < N - 1; i++) {
      k3_v[i] = dt * f_v(v_k3, h_k3, i, current_stimulus);
      k3_h[i] = dt * f_h(v_k3, h_k3, i);
    }

    // K4
    const v_k4 = [...v_prev];
    const h_k4 = [...h_prev];
    for (let i = 1; i < N - 1; i++) {
      v_k4[i] = v_prev[i] + k3_v[i];
      h_k4[i] = h_prev[i] + k3_h[i];
    }
    // Aplica as condições de contorno para o cálculo de K4
    v_k4[0] = v_k4[1];
    v_k4[N - 1] = v_k4[N - 2];
    h_k4[0] = h_k4[1];
    h_k4[N - 1] = h_k4[N - 2];
    for (let i = 1; i < N - 1; i++) {
      k4_v[i] = dt * f_v(v_k4, h_k4, i, current_stimulus);
      k4_h[i] = dt * f_h(v_k4, h_k4, i);
    }

    // Atualiza os valores de v e h 
    for (let i = 1; i < N - 1; i++) {
      v[i] = v_prev[i] + (1.0 / 6.0) * (k1_v[i] + 2 * k2_v[i] + 2 * k3_v[i] + k4_v[i]);
      h[i] = h_prev[i] + (1.0 / 6.0) * (k1_h[i] + 2 * k2_h[i] + 2 * k3_h[i] + k4_h[i]);
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