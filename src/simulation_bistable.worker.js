self.onmessage = (e) => {
  const params = e.data;
  let {
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

  // Verifica e ajusta a condição de CFL
  const cfl_limit = (dx * dx) / (2 * k);
  if (dt > cfl_limit) {
    dt = cfl_limit * 0.9; // Ajusta dt para um valor seguro
  }

  // Calcula o número de celulas na grade
  const N = Math.floor(L / dx);

  // Inicializa o array para a variável v
  let v = new Array(N).fill(0);
  
  // Condição inicial
  const initial_width = Math.floor(N / 10);
  for(let i = 0; i < initial_width; i++) {
    v[i] = 1.05; // Ativa os primeiros 10% dos pontos com um valor acima do limiar
  }

  // Calcula o número total de passos de tempo 
  const steps = Math.floor(totalTime / dt);
  // Array para armazenar os resultados em intervalos específicos
  const outputData = [];

  function f_v(vv, i) { // Derivada de V
    // Calcula a difusão do potencial para os vizinhos
    const diffusion = k * (vv[i + 1] - 2 * vv[i] + vv[i - 1]) / (dx * dx);
    // Calcula a reação 
    const reaction = A * vv[i] * (1 - vv[i]) * (vv[i] - alpha);
    return diffusion + reaction;
  }

  // Loop principal 
  for (let t = 0; t < steps; t++) {
    // Cria uma cópia dos valores do passo anterior
    const v_prev = [...v];

    // Ks do runge-kutta 4
    const k1 = new Array(N).fill(0);
    const k2 = new Array(N).fill(0);
    const k3 = new Array(N).fill(0);
    const k4 = new Array(N).fill(0);

    // K1
    for (let i = 1; i < N - 1; i++) {
      k1[i] = dt * f_v(v_prev, i);
    }
    // Aplica as condições de contorno de Neumann
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

    // Calcula o próximo valor de v
    for (let i = 1; i < N - 1; i++) {
      v[i] = v_prev[i] + (1.0 / 6.0) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]);
    }

    // Aplica as condições de contorno de Neumann no final do passo de tempo
    v[0] = v[1];
    v[N - 1] = v[N - 2];

    // Salva os dados em intervalos definidos pelo downsamplingFactor
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

  // Envia os dados ara a thread principal
  self.postMessage(outputData);
};