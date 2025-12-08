self.onmessage = (e) => {
  const params = e.data;
  
  // Parâmetros
  const { 
    sigma_l, sigma_t, fiber_angle, Tau_in, Tau_out, Tau_open, Tau_close, gate, 
    L, dx, totalTime, downsamplingFactor, stimuli, 
    obstacleParams, slitParams
  } = params;
  let { dt } = params;
  
  // Calcula o número de pontos na grade
  const N = Math.floor(L / dx);
  
  // Converte o ângulo das fibras para radianos e calcula seno/cosseno
  const rad = (fiber_angle * Math.PI) / 180.0;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  const c2 = c * c;
  const s2 = s * s;
  const cs = c * s;

  // Calcula os componentes do Tensor de Difusão
  const base_Dxx = sigma_l * c2 + sigma_t * s2;
  const base_Dyy = sigma_l * s2 + sigma_t * c2;
  const base_Dxy = (sigma_l - sigma_t) * cs;

  // Condição de CFL
  const max_D = Math.max(base_Dxx, base_Dyy);
  const cfl_denominator = 4 * max_D + 2 * Math.abs(base_Dxy);
  const cfl_limit = (dx * dx) / (cfl_denominator || 1); 
  
  if (dt > cfl_limit) dt = cfl_limit * 0.9;

  // V e h
  let v = new Float32Array(N * N).fill(0.0);
  let h = new Float32Array(N * N).fill(1.0);
  
  // Mapas de difusão e geometria
  let Dxx_map = new Float32Array(N * N).fill(0.0);
  let Dyy_map = new Float32Array(N * N).fill(0.0);
  let Dxy_map = new Float32Array(N * N).fill(0.0);
  let geometryMap = new Float32Array(N * N).fill(0.0);

  // Definição da Geometria do Circulo e da Fenda
  const { cx, cy, radius } = obstacleParams;
  const { widthStart, widthEnd } = slitParams;
  const rSq = radius * radius;

  // Limites verticais da largura da fenda
  const y_min = cy - radius;
  const y_max = cy + radius;
  const height = y_max - y_min;

  // Loop para configurar a geometria ponto a ponto
  for (let i = 0; i < N; i++) { 
      for (let j = 0; j < N; j++) {
          const idx = i * N + j;
          const y = i * dx; 
          const x = j * dx;
          
          let isTissue = true; 

          // Verifica a distância do ponto atual ao centro do obstáculo
          const distSq = (x - cx)**2 + (y - cy)**2;
          
          // Se estiver dentro do raio do obstáculo, verifica se cai na fenda
          if (distSq <= rSq) {
              // Calcula a largura da fenda baseada na altura Y
              const t_y = Math.max(0, Math.min(1, (y - y_min) / height));
              const currentWidth = widthStart + t_y * (widthEnd - widthStart);
              const halfWidth = currentWidth / 2.0;
              
              // Se estiver dentro da largura da fenda, é tecido. Senão é  obstáculo
              if (x >= (cx - halfWidth) && x <= (cx + halfWidth)) {
                  isTissue = true; // Fenda condutiva
              } else {
                  isTissue = false; // Parede isolante
              }
          }

          // Preenche os mapas de difusão baseado se é tecido ou não
          if (isTissue) {
              Dxx_map[idx] = base_Dxx;
              Dyy_map[idx] = base_Dyy;
              Dxy_map[idx] = base_Dxy;
              geometryMap[idx] = 1.0; 
          } else {
              Dxx_map[idx] = 0.0;
              Dyy_map[idx] = 0.0;
              Dxy_map[idx] = 0.0;
              geometryMap[idx] = 0.0;
          }
      }
  }

  // Prepara os mapas onde os estímulos serão aplicados
  const stimulus_maps = [];
  const stimulus_timings = [];
  let cumulativeTime = 0;

  stimuli.forEach((stim, index) => {
    let map = new Uint8Array(N * N).fill(0);
    
    // Configura região circular para o estímulo
    if (stim.shape === 'circle') {
        const { cx: sCx, cy: sCy, radius: sR } = stim.circleParams;
        const sRSq = sR * sR;
        for (let i = 0; i < N; i++) {
            for (let j = 0; j < N; j++) {
                const y = i * dx;
                const x = j * dx;
                // Verifica se está dentro do raio do estímulo e se é tecido condutivo
                if (((x - sCx)**2 + (y - sCy)**2) <= sRSq) {
                    if (geometryMap[i*N+j] > 0) map[i*N+j] = 1;
                }
            }
        }
    } 
    
    stimulus_maps.push(map);
    // Define os tempos de início e fim do estímulo
    let startTime = (index === 0) ? stim.startTime : cumulativeTime + stim.interval;
    const endTime = startTime + stim.duration;
    cumulativeTime = endTime;
    stimulus_timings.push({ startTime, endTime, amplitude: stim.amplitude });
  });

  // Configuração do loop temporal
  const steps = Math.floor(totalTime / dt);
  const expectedFrames = Math.floor(steps / downsamplingFactor) + 1;
  
  // Buffers para armazenar os resultados
  const framesBuffer = new Float32Array(expectedFrames * N * N); 
  const timesBuffer = new Float32Array(expectedFrames); 
  
  let frameCount = 0;
  const inv_4dx2 = 1.0 / (4.0 * dx * dx);
  const inv_dx2 = 1.0 / (dx * dx);
  const progressInterval = Math.max(1, Math.floor(steps / 100));
  const startTimeReal = performance.now();

  // Loop principal
  for (let t = 0; t < steps; t++) {
      // barra de progresso
      if (t % progressInterval === 0) {
          const progress = Math.round((t / steps) * 100);
          let remaining = 0;
          if (t > 0) {
              const elapsed = performance.now() - startTimeReal;
              const rate = elapsed / t;
              remaining = (steps - t) * rate;
          }
          self.postMessage({ type: 'progress', value: progress, remaining });
      }

      const v_prev = new Float32Array(v);
      const h_prev = new Float32Array(h);
      const currentTime = t * dt;
      
      let stimulus_amplitude = 0;
      let current_stimulus_map = null;

      // Verifica se há algum estímulo ativo no tempo atual
      for(let i = 0; i < stimulus_timings.length; i++) {
        const timing = stimulus_timings[i];
        if(currentTime >= timing.startTime && currentTime < timing.endTime) {
          stimulus_amplitude = timing.amplitude;
          current_stimulus_map = stimulus_maps[i];
          break;
        }
      }
      
      // Loop espacial
      for (let i = 1; i < N - 1; i++) {
          for (let j = 1; j < N - 1; j++) {
              const idx = i * N + j;
              
              // Se for obstáculo, pula o cálculo
              if (geometryMap[idx] === 0) { 
                  v[idx] = -0.1; // valor para ser colorido de preto.
                  continue; 
              }

              const vp = v_prev[idx];
              const hp = h_prev[idx];
              
              const Dxx = Dxx_map[idx];
              const Dyy = Dyy_map[idx];
              const Dxy = Dxy_map[idx];
              
              const stimulus = current_stimulus_map ? current_stimulus_map[idx] * stimulus_amplitude : 0;

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
                h[idx] = h_inf + (hp - h_inf) * h_exp;
              } 

              // Cálculo das derivadas espaciais
              const d2v_dx2 = (v_prev[idx - 1] - 2 * vp + v_prev[idx + 1]) * inv_dx2;
              const d2v_dy2 = (v_prev[idx - N] - 2 * vp + v_prev[idx + N]) * inv_dx2;
              const d2v_dxdy = (v_prev[idx + N + 1] - v_prev[idx + N - 1] - v_prev[idx - N + 1] + v_prev[idx - N - 1]) * inv_4dx2;

              const lap_v_anisotropic = (Dxx * d2v_dx2) + (Dyy * d2v_dy2) + (2 * Dxy * d2v_dxdy);
              
              // Correntes de reação
              const J_in = (hp * vp * vp * (1 - vp)) / Tau_in;
              const J_out = -vp / Tau_out;
              
              // Euler Explícito para v
              v[idx] = vp + dt * (lap_v_anisotropic + J_in + J_out + stimulus);
              
              // Garante que os valores fiquem no intervalo [0, 1]
              v[idx] = Math.max(0.0, Math.min(1.0, v[idx]));
              h[idx] = Math.max(0.0, Math.min(1.0, h[idx]));
          }
      }
      
      // Condições de contorno simples
      for (let i = 0; i < N; i++) {
          if (geometryMap[i*N] > 0) v[i*N] = v[i*N+1];
          if (geometryMap[i*N+N-1] > 0) v[i*N+N-1] = v[i*N+N-2];
      }
      for (let j = 0; j < N; j++) {
          if (geometryMap[j] > 0) v[j] = v[N+j];
          if (geometryMap[(N-1)*N+j] > 0) v[(N-1)*N+j] = v[(N-2)*N+j];
      }

      // Downsampling
      if (t % downsamplingFactor === 0) {
          framesBuffer.set(v, frameCount * N * N);
          timesBuffer[frameCount] = currentTime;
          frameCount++;
      }
  }

  // Retorna os resultados
  self.postMessage(
      { 
          type: 'result', 
          frames: framesBuffer, 
          times: timesBuffer,
          fibrosis: geometryMap, 
          N,
          totalFrames: frameCount
      }, 
      [framesBuffer.buffer, timesBuffer.buffer, geometryMap.buffer]
  );
};