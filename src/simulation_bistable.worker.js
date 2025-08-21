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

  // Condição inicial
  const initial_width = Math.floor(N / 10);
  for(let i = 0; i < initial_width; i++) {
    v[i] = 1.05;
  }

  // Calcula o total de passos
  const steps = Math.floor(totalTime / dt);
  // Resultados
  const outputData = [];

  // Loop principal da simulação
  for (let t = 0; t < steps; t++) {
    // valor de v do passo anterior
    const v_prev = [...v];
    
    // euler
    for (let i = 1; i < N - 1; i++) {

      const diffusion = k * (v_prev[i + 1] - 2 * v_prev[i] + v_prev[i - 1]) / (dx * dx); // Termo de difusão

      const reaction = A * v_prev[i] * (1 - v_prev[i]) * (v_prev[i] - alpha); // Termo de reação

      v[i] = v_prev[i] + dt * (diffusion + reaction); // atualiza v
    }

    // Aplica as condições de contorno
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