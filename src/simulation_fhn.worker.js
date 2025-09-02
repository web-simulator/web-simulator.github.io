
self.onmessage = (e) => {
  // parâmetros inseridos
  const params = e.data;
  const {
    // Parâmetros do modelo
    k,
    A,
    alpha,
    epsilon,
    gamma,

    // Parâmetros da Simulação
    L,
    dx,
    dt,
    totalTime,
    downsamplingFactor,

    // Decide qual modelo usar
    initialCondition // pulso na borda ou reentrada
  } = params;

  const N = Math.floor(L / dx); // Calcula o número de pontos

  let v = new Array(N).fill(0); // Vetor de ativação
  let w = new Array(N).fill(0); // Vetor de recuperação/inibição

  // Seleciona e aplica a condição inicial com base no parâmetro recebido
  if (initialCondition === 'reentry') {
    const mid = Math.floor(N / 2); // Encontra o índice do ponto central.
    for (let i = mid - 2; i < mid + 2; i++) {
        v[i] = 1.05; // Valor acima do limiar para iniciar a ativação
    }
    for (let i = 0; i < Math.floor(0.9 * mid); i++) {
        w[i] = 1.0;
    }
  } else { // left_pulse'
    const initial_width = Math.floor(N / 10); // Define a largura do pulso inicial
    for(let i = 0; i < initial_width; i++) {
        v[i] = 1.05; // Ativa os primeiros pontos
    }
  }

  // Calcula o número total de passos de tempo
  const steps = Math.floor(totalTime / dt);
  const outputData = []; // resultados da simulação

  // Loop principal da simulação
  for (let t = 0; t < steps; t++) {
    // Funções de derivada para o método RK4
    function f_v(vv, ww, i) { // Derivada de V
      const diffusion = k * (vv[i + 1] - 2 * vv[i] + vv[i - 1]) / (dx * dx);
      const reaction_v = A * vv[i] * (1 - vv[i]) * (vv[i] - alpha);
      return diffusion + reaction_v - ww[i];
    }
    
    function f_w(vv, ww, i) { // Derivada de W
      return epsilon * (vv[i] - gamma * ww[i]);
    }

    // Calcula os K's para RK4 para cada ponto do espaço
    const k1_v = new Array(N);
    const k1_w = new Array(N);
    const k2_v = new Array(N);
    const k2_w = new Array(N);
    const k3_v = new Array(N);
    const k3_w = new Array(N);
    const k4_v = new Array(N);
    const k4_w = new Array(N);

    // K1
    for (let i = 1; i < N - 1; i++) {
      k1_v[i] = dt * f_v(v, w, i);
      k1_w[i] = dt * f_w(v, w, i);
    }
    
    // K2
    const v_k2 = [...v];
    const w_k2 = [...w];
    for (let i = 1; i < N - 1; i++) {
      v_k2[i] = v[i] + 0.5 * k1_v[i];
      w_k2[i] = w[i] + 0.5 * k1_w[i];
    }
    v_k2[0] = v_k2[1];
    v_k2[N - 1] = v_k2[N - 2];
    w_k2[0] = w_k2[1];
    w_k2[N - 1] = w_k2[N - 2];

    for (let i = 1; i < N - 1; i++) {
      k2_v[i] = dt * f_v(v_k2, w_k2, i);
      k2_w[i] = dt * f_w(v_k2, w_k2, i);
    }

    // K3
    const v_k3 = [...v];
    const w_k3 = [...w];
    for (let i = 1; i < N - 1; i++) {
      v_k3[i] = v[i] + 0.5 * k2_v[i];
      w_k3[i] = w[i] + 0.5 * k2_w[i];
    }
    v_k3[0] = v_k3[1];
    v_k3[N - 1] = v_k3[N - 2];
    w_k3[0] = w_k3[1];
    w_k3[N - 1] = w_k3[N - 2];

    for (let i = 1; i < N - 1; i++) {
      k3_v[i] = dt * f_v(v_k3, w_k3, i);
      k3_w[i] = dt * f_w(v_k3, w_k3, i);
    }

    // K4
    const v_k4 = [...v];
    const w_k4 = [...w];
    for (let i = 1; i < N - 1; i++) {
      v_k4[i] = v[i] + k3_v[i];
      w_k4[i] = w[i] + k3_w[i];
    }
    v_k4[0] = v_k4[1];
    v_k4[N - 1] = v_k4[N - 2];
    w_k4[0] = w_k4[1];
    w_k4[N - 1] = w_k4[N - 2];
    
    for (let i = 1; i < N - 1; i++) {
      k4_v[i] = dt * f_v(v_k4, w_k4, i);
      k4_w[i] = dt * f_w(v_k4, w_k4, i);
    }

    // Atualiza v e w usando a média ponderada dos K's
    for (let i = 1; i < N - 1; i++) {
      v[i] = v[i] + (1.0 / 6.0) * (k1_v[i] + 2 * k2_v[i] + 2 * k3_v[i] + k4_v[i]);
      w[i] = w[i] + (1.0 / 6.0) * (k1_w[i] + 2 * k2_w[i] + 2 * k3_w[i] + k4_w[i]);
    }

    // Condições de Neumann nas bordas
    v[0] = v[1];
    v[N - 1] = v[N - 2];
    w[0] = w[1];
    w[N - 1] = w[N - 2];

    // Salva o snapshot
    if (t % downsamplingFactor === 0) {
      const snapshot = v.map((v_val, index) => ({
        x: index * dx,
        v: v_val,
        w: w[index],
        tempo: (t * dt).toFixed(2)
      }));
      outputData.push({
        time: (t * dt).toFixed(2),
        data: snapshot
      });
    }
  }

  // Retorna os dados da simulação
  self.postMessage(outputData);
};