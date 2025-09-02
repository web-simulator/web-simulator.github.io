self.onmessage = (e) => {
  const params = e.data;
  const {
    // Parâmetros do modelo
    k,
    A,
    alpha,
    // Parâmetros da Simulação
    L,
    dx,
    dt,
    totalTime,
    downsamplingFactor
  } = params;

  // Calcula o número de pontos na grade
  const N = Math.floor(L / dx);

  let v = new Array(N).fill(0); // Array para a variável de ativação
  const v_prev_sim = new Array(N).fill(0); // Array temporário para RK4

  // Condição inicial
  const initial_width = Math.floor(N / 10);
  for(let i = 0; i < initial_width; i++) {
    v[i] = 1.05;
  }

  // Calcula o total de passos
  const steps = Math.floor(totalTime / dt);
  // Resultados
  const outputData = [];

  // Funções de derivada para o método RK4
  function f_v(vv, i) { // Derivada de V
    const diffusion = k * (vv[i + 1] - 2 * vv[i] + vv[i - 1]) / (dx * dx);
    const reaction = A * vv[i] * (1 - vv[i]) * (vv[i] - alpha);
    return diffusion + reaction;
  }

  // Loop principal da simulação
  for (let t = 0; t < steps; t++) {
    // valores de v do passo anterior
    const v_prev = [...v];

    // Calcula os K's para RK4 para cada ponto do espaço
    const k1 = new Array(N).fill(0);
    const k2 = new Array(N).fill(0);
    const k3 = new Array(N).fill(0);
    const k4 = new Array(N).fill(0);

    // K1
    for (let i = 1; i < N - 1; i++) {
      k1[i] = dt * f_v(v_prev, i);
    }
    v_prev[0] = v_prev[1];
    v_prev[N - 1] = v_prev[N - 2];

    // K2
    const v_k2 = [...v_prev];
    for (let i = 1; i < N - 1; i++) {
      v_k2[i] = v_prev[i] + 0.5 * k1[i];
    }
    v_k2[0] = v_k2[1];
    v_k2[N - 1] = v_k2[N - 2];
    for (let i = 1; i < N - 1; i++) {
      k2[i] = dt * f_v(v_k2, i);
    }

    // K3
    const v_k3 = [...v_prev];
    for (let i = 1; i < N - 1; i++) {
      v_k3[i] = v_prev[i] + 0.5 * k2[i];
    }
    v_k3[0] = v_k3[1];
    v_k3[N - 1] = v_k3[N - 2];
    for (let i = 1; i < N - 1; i++) {
      k3[i] = dt * f_v(v_k3, i);
    }

    // K4
    const v_k4 = [...v_prev];
    for (let i = 1; i < N - 1; i++) {
      v_k4[i] = v_prev[i] + k3[i];
    }
    v_k4[0] = v_k4[1];
    v_k4[N - 1] = v_k4[N - 2];
    for (let i = 1; i < N - 1; i++) {
      k4[i] = dt * f_v(v_k4, i);
    }

    // Atualiza v usando a média ponderada dos K's
    for (let i = 1; i < N - 1; i++) {
      v[i] = v_prev[i] + (1.0 / 6.0) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]);
    }

    // Condições de contorno de Neumann
    v[0] = v[1];
    v[N - 1] = v[N - 2];

    if (t % downsamplingFactor === 0) {
      const snapshot = v.map((value, index) => ({
        x: index * dx,
        v: value,
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