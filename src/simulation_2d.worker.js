self.onmessage = (e) => {
  const params = e.data;
  let {
    D,
    L,
    N,
    dt,
    totalTime,
    downsamplingFactor,
    valor_inicial
  } = params;

  const dx = L / (N - 1);
  const dy = L / (N - 1);

  // condição de CFL para 2D
  const cfl_limit = (dx * dx) / (4 * D);
  if (dt > cfl_limit) {
    dt = cfl_limit * 0.9; // ajusta dt para 90% do limite
  }

  // inicializa u com zeros
  let u = Array(N).fill(0).map(() => Array(N).fill(0));

  // condição inicial é um quadrado central com valor_inicial
  const center = Math.floor(N / 2);
  const stimulusSize = 2; // ajusta o tamanho do estímulo inicial
  for (let di = -stimulusSize; di <= stimulusSize; di++) { 
    for (let dj = -stimulusSize; dj <= stimulusSize; dj++) { 
      const ii = center + di;
      const jj = center + dj;
      if (ii >= 0 && ii < N && jj >= 0 && jj < N) {
        u[ii][jj] = valor_inicial; // valor inicial no centro
      }
    }
  }

  const steps = Math.floor(totalTime / dt); 
  const outputData = [];

  // loop de tempo
  for (let t = 0; t < steps; t++) {
    const u_prev = u.map(row => [...row]);

    // atualiza interior com laplaciano central
    for (let i = 1; i < N - 1; i++) {
      for (let j = 1; j < N - 1; j++) {
        const laplacian = // laplaciano 
          (u_prev[i + 1][j] + u_prev[i - 1][j] - 2 * u_prev[i][j]) / (dx * dx) +
          (u_prev[i][j + 1] + u_prev[i][j - 1] - 2 * u_prev[i][j]) / (dy * dy);

        u[i][j] = u_prev[i][j] + dt * (D * laplacian); // atualiza u
      }
    }

    // condições de contorno Neumann
    for (let j = 0; j < N; j++) {
      u[0][j] = u[1][j]; 
      u[N - 1][j] = u[N - 2][j]; 
    }
    // bordas verticais
    for (let i = 0; i < N; i++) {
      u[i][0] = u[i][1];         
      u[i][N - 1] = u[i][N - 2];
    }

    // armazena dados para saída com downsampling
    if (t % downsamplingFactor === 0) {
      outputData.push({
        time: (t * dt).toFixed(4),
        data: u.map(row => [...row])
      });
    }
  }

  // envia dados de volta ao thread principal
  self.postMessage(outputData);
};
