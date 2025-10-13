self.onmessage = (e) => {
  // Parâmetros
  const params = e.data;
  const { modelType } = params;

  if (modelType === 'diffusion') { // Modelo da difusão simples
    // Parâmetros da simulação
    let { D, L, dt, dx, totalTime, downsamplingFactor, valor_inicial, stimulusRegion, rectangleParams, circleParams } = params;
    
    // Número de pontos da malha
    const N = Math.floor(L / dx);
    const dy = dx; // Malha quadrada

    // Condição de CFL
    const cfl_limit = (dx * dx) / (4 * D);
    if (dt > cfl_limit) dt = cfl_limit * 0.9;

    // Cria a matriz que representa o tecido
    let u = Array(N).fill(0).map(() => Array(N).fill(0));

    // Define a condição inicial com base na forma selecionada
    if (stimulusRegion === 'rectangle') {
      const { x1, y1, x2, y2 } = rectangleParams;
      const i1 = Math.floor(y1 / dy), j1 = Math.floor(x1 / dx), i2 = Math.floor(y2 / dy), j2 = Math.floor(x2 / dx);
      for (let i = Math.min(i1, i2); i <= Math.max(i1, i2); i++) {
        for (let j = Math.min(j1, j2); j <= Math.max(j1, j2); j++) {
          if (i >= 0 && i < N && j >= 0 && j < N) u[i][j] = valor_inicial;
        }
      }
    } else if (stimulusRegion === 'circle') {
      const { cx, cy, radius } = circleParams;
      const radiusSq = radius * radius;
      for (let i = 0; i < N; i++) {
        for (let j = 0; j < N; j++) {
          if (((j * dx - cx) ** 2) + ((i * dy - cy) ** 2) <= radiusSq) u[i][j] = valor_inicial;
        }
      }
    }

    // Número total de passos da simulação
    const steps = Math.floor(totalTime / dt);
    const outputData = []; // Resultados

    // Loop de tempo
    for (let t = 0; t < steps; t++) {
      const u_prev = u.map(row => [...row]); // Cria uma cópia do estado anterior

      // Calcula o novo valor em cada ponto interno da malha
      for (let i = 1; i < N - 1; i++) {
        for (let j = 1; j < N - 1; j++) {
          const laplacian = (u_prev[i + 1][j] + u_prev[i - 1][j] - 2 * u_prev[i][j]) / (dx * dx) + (u_prev[i][j + 1] + u_prev[i][j - 1] - 2 * u_prev[i][j]) / (dy * dy);
          u[i][j] = u_prev[i][j] + dt * (D * laplacian);
        }
      }
      
      // Aplica condições de contorno de Neumann 
      for (let j = 0; j < N; j++) { u[0][j] = u[1][j]; u[N - 1][j] = u[N - 2][j]; }
      for (let i = 0; i < N; i++) { u[i][0] = u[i][1]; u[i][N - 1] = u[i][N - 2]; }

      // Salva os resultados com base no downsampling
      if (t % downsamplingFactor === 0) outputData.push({ time: (t * dt).toFixed(4), data: u.map(row => [...row]) });
    }
    self.postMessage(outputData);
  } else if (modelType === 'ms2d') { // Mitchell-Schaeffer 2D
    // Paraâmetros da simulação
    let { k, Tau_in, Tau_out, Tau_open, Tau_close, gate, L, dt, dx, totalTime, downsamplingFactor, stimulusProtocol, stimulusRegion, rectangleParams, circleParams, s1s2Params } = params;
    const N = Math.floor(L / dx);
    const dy = dx;

    // Condição de CFL
    const cfl_limit = (dx * dx) / (4 * k);
    if (dt > cfl_limit) dt = cfl_limit * 0.9;

    // Cria as matrizes para o potencial e a variável gate
    let v = Array(N).fill(0).map(() => Array(N).fill(0.0));
    let h = Array(N).fill(0).map(() => Array(N).fill(1.0));

    // Define onde o estímulo será aplicado
    let stimulus_map = Array(N).fill(0).map(() => Array(N).fill(0));

    // Define a região do estímulo 
    if (stimulusRegion === 'rectangle') { // Retângulo
      const { x1, y1, x2, y2 } = rectangleParams;
      const i1 = Math.floor(y1 / dy), j1 = Math.floor(x1 / dx), i2 = Math.floor(y2 / dy), j2 = Math.floor(x2 / dx);
      for (let i = Math.min(i1, i2); i <= Math.max(i1, i2); i++) {
        for (let j = Math.min(j1, j2); j <= Math.max(j1, j2); j++) {
          if (i >= 0 && i < N && j >= 0 && j < N) stimulus_map[i][j] = 1;
        }
      }
    } else if (stimulusRegion === 'circle') { // Círculo
      const { cx, cy, radius } = circleParams;
      const radiusSq = radius * radius;
      for (let i = 0; i < N; i++) {
        for (let j = 0; j < N; j++) {
          if (((j * dx - cx) ** 2) + ((i * dy - cy) ** 2) <= radiusSq) stimulus_map[i][j] = 1;
        }
      }
    }
    
    // Se for um estímulo único, já define o valor inicial de v
    if (stimulusProtocol === 'single') {
        for (let i = 0; i < N; i++) {
            for (let j = 0; j < N; j++) {
                if (stimulus_map[i][j] === 1) v[i][j] = 1.0;
            }
        }
    }

    const steps = Math.floor(totalTime / dt);
    const outputData = [];

    // Loop principal da simulação
    for (let t = 0; t < steps; t++) {
      const v_prev = v.map(row => [...row]);
      const h_prev = h.map(row => [...row]);
      
      let stimulus_amplitude = 0;
      if (stimulusProtocol === 's1s2') { // Protocolo S1-S2
          // Calcula o tempo atual
          const currentTime = t * dt;
          const { BCL_S1, intervalo_S2, num_estimulos_s1, duracao_estimulo, amplitude } = s1s2Params;

          // Aplica os pulsos S1
          for (let i = 0; i < num_estimulos_s1; i++) {
              const pulse_start = i * BCL_S1;
              if (currentTime >= pulse_start && currentTime < pulse_start + duracao_estimulo) {
                  stimulus_amplitude = amplitude;
                  break;
              }
          }
          // Aplica o pulso S2
          if (stimulus_amplitude === 0) {
            const s2_start = (num_estimulos_s1 - 1) * BCL_S1 + intervalo_S2;
            if (currentTime >= s2_start && currentTime < s2_start + duracao_estimulo) {
                stimulus_amplitude = amplitude;
            }
          }
      }

      // Calcula o novo valor de v e h em cada ponto interno da malha
      for (let i = 1; i < N - 1; i++) {
        for (let j = 1; j < N - 1; j++) {
          const vp = v_prev[i][j];
          const hp = h_prev[i][j];
          
          // Calcula o termo de difusão
          const laplacian_v = (v_prev[i + 1][j] + v_prev[i - 1][j] + v_prev[i][j + 1] + v_prev[i][j - 1] - 4 * vp) / (dx * dx);
          
          // Calcula os termos de reação do modelo
          const J_in = (hp * vp * vp * (1 - vp)) / Tau_in;
          const J_out = -vp / Tau_out;
          
          // Aplica o estímulo nos pontos definidos pelo stimulus_map
          const current_stimulus = stimulus_map[i][j] * stimulus_amplitude;

          // Atualiza v e h usando o método de Euler
          v[i][j] = vp + dt * (k * laplacian_v + J_in + J_out + current_stimulus);
          h[i][j] = hp + dt * ((vp < gate) ? (1 - hp) / Tau_open : -hp / Tau_close);

          // Garante que os valores permaneçam no intervalo 0 a 1
          v[i][j] = Math.max(0.0, Math.min(1.0, v[i][j]));
          h[i][j] = Math.max(0.0, Math.min(1.0, h[i][j]));
        }
      }
      
      // Aplica condições de contorno
      for (let j = 0; j < N; j++) { v[0][j] = v[1][j]; v[N - 1][j] = v[N - 2][j]; h[0][j] = h[1][j]; h[N - 1][j] = h[N - 2][j]; }
      for (let i = 0; i < N; i++) { v[i][0] = v[i][1]; v[i][N - 1] = v[i][N - 2]; h[i][0] = h[i][1]; h[i][N - 1] = h[i][N - 2]; }

      // Salva o resultado em intervalos
      if (t % downsamplingFactor === 0) outputData.push({ time: (t * dt).toFixed(4), data: v.map(row => [...row]) });
    }
    self.postMessage(outputData);
  }
};