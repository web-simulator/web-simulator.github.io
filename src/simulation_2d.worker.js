// Classe para gerar números aleatórios. A mesma seed gera os mesmos resultados
class SeededRandom {
  constructor(seed = Date.now()) {
    this.seed = seed % 2147483647;
    if (this.seed <= 0) this.seed += 2147483646;
  }
  // Gera o próximo número aleatório
  next() {
    this.seed = (this.seed * 16807) % 2147483647;
    return this.seed / 2147483647;
  }
  // Gera um número aleatório inteiro dentro de um intervalo
  nextInt(min, max) {
    // Garante que min <= max
    if (min > max) {
      [min, max] = [max, min];
    }
    return Math.floor(this.next() * (max - min + 1)) + min;
  }
}

self.onmessage = (e) => {
  const params = e.data; // Parâmetros enviados
  const { modelType } = params; // Tipo de modelo

    const { sigma_l, sigma_t, angle, Tau_in, Tau_out, Tau_open, Tau_close, gate, L, dx, totalTime, downsamplingFactor, stimuli, fibrosisParams } = params;
    let { dt } = params;
    
    // Calcula o tamanho da malha
    const N = Math.floor(L / dx);
    const dy = dx; // A malha é quadrada

    // Converte ângulo para radianos e calcula seno e cosseno
    const rad = (angle * Math.PI) / 180.0;
    const c = Math.cos(rad);
    const s = Math.sin(rad);
    const c2 = c * c;
    const s2 = s * s;
    const cs = c * s;

    // Calcula os componentes base do Tensor de Difusão D
    const base_Dxx = sigma_l * c2 + sigma_t * s2;
    const base_Dyy = sigma_l * s2 + sigma_t * c2;
    const base_Dxy = (sigma_l - sigma_t) * cs;

    // Condição de CFL 
    const max_D = Math.max(base_Dxx, base_Dyy);
    const cfl_denominator = 4 * max_D + 2 * Math.abs(base_Dxy);
    const cfl_limit = (dx * dx) / (cfl_denominator || 1); 
    
    if (dt > cfl_limit) dt = cfl_limit * 0.9;

    // Arrays para V e h
    let v = new Float32Array(N * N).fill(0.0);
    let h = new Float32Array(N * N).fill(1.0);
    
    // Mapas do Tensor de Difusão
    let Dxx_map = new Float32Array(N * N).fill(base_Dxx);
    let Dyy_map = new Float32Array(N * N).fill(base_Dyy);
    let Dxy_map = new Float32Array(N * N).fill(base_Dxy);
    
    // Mapa de fibrose para visualização
    let fibrosisMap = new Float32Array(N * N).fill(sigma_l); 

    if (fibrosisParams.enabled) {
      const { conductivity, type, distribution, shape, rectParams, circleParams, regionParams } = fibrosisParams;

      // Preenche todos os pontos dentro da forma geométrica
      if (type === 'compacta' && distribution === 'region') {
          if (shape === 'rectangle') {
              const { x1, y1, x2, y2 } = rectParams;
              // Converte coordenadas físicas para índices
              const i_start = Math.floor(Math.min(y1, y2) / dx);
              const i_end = Math.floor(Math.max(y1, y2) / dx);
              const j_start = Math.floor(Math.min(x1, x2) / dx);
              const j_end = Math.floor(Math.max(x1, x2) / dx);

              // Preenche o retângulo
              for (let i = Math.max(0, i_start); i <= Math.min(N - 1, i_end); i++) {
                  for (let j = Math.max(0, j_start); j <= Math.min(N - 1, j_end); j++) {
                      const idx = i * N + j;
                      Dxx_map[idx] = conductivity;
                      Dyy_map[idx] = conductivity;
                      Dxy_map[idx] = 0.0;
                      fibrosisMap[idx] = conductivity;
                  }
              }
          } else { // Circle
              const { cx, cy, radius } = circleParams;
              const radiusSq = radius * radius;
              
              // Percorre apenas o bounding box do círculo
              const i_start = Math.max(0, Math.floor((cy - radius) / dx));
              const i_end = Math.min(N - 1, Math.floor((cy + radius) / dx));
              const j_start = Math.max(0, Math.floor((cx - radius) / dx));
              const j_end = Math.min(N - 1, Math.floor((cx + radius) / dx));

              for (let i = i_start; i <= i_end; i++) {
                  for (let j = j_start; j <= j_end; j++) {
                      const y = i * dx;
                      const x = j * dx;
                      // Verifica se o ponto está dentro do círculo
                      if ((x - cx) ** 2 + (y - cy) ** 2 <= radiusSq) {
                          const idx = i * N + j;
                          Dxx_map[idx] = conductivity;
                          Dyy_map[idx] = conductivity;
                          Dxy_map[idx] = 0.0;
                          fibrosisMap[idx] = conductivity;
                      }
                  }
              }
          }
      } 
      else {
          const { density, seed } = fibrosisParams;
          const random = new SeededRandom(seed); 
          
          let numRegions, i_min, i_max, j_min, j_max;
          let checkInsideRegion = () => true;

          const pixelArea = dx * dx; // Área de um único ponto

          if (type === 'difusa') {
            // Fibrose difusa
            const { x1, y1, x2, y2 } = regionParams;
            i_min = Math.floor(Math.min(y1, y2) / dy);
            i_max = Math.floor(Math.max(y1, y2) / dy);
            j_min = Math.floor(Math.min(x1, x2) / dx);
            j_max = Math.floor(Math.max(x1, x2) / dx);
            const regionArea = (Math.abs(x2 - x1) * Math.abs(y2 - y1));
            numRegions = Math.ceil((regionArea * density) / pixelArea);

          } else { 
            // Compacta Aleatória
            i_min = 0; i_max = N - 1;
            j_min = 0; j_max = N - 1;
            numRegions = Math.ceil(((L * L) * density) / pixelArea);
          }

          // Garante limites dentro da matriz
          i_min = Math.max(0, i_min); i_max = Math.min(N - 1, i_max);
          j_min = Math.max(0, j_min); j_max = Math.min(N - 1, j_max);

          let generated = 0;
          let attempts = 0;
          const maxAttempts = numRegions * 5; // Evita loop infinito

          while (generated < numRegions && attempts < maxAttempts) {
            attempts++;
            
            // Gera centros aleatórios para os pontos
            const centerRow = random.nextInt(i_min, i_max);
            const centerCol = random.nextInt(j_min, j_max);

            // Verifica se o centro está dentro da região definida 
            if (!checkInsideRegion(centerRow, centerCol)) {
              continue;
            }

            generated++;

            // Define a condutividade apenas no ponto selecionado
            const idx = centerRow * N + centerCol;
            Dxx_map[idx] = conductivity;
            Dyy_map[idx] = conductivity;
            Dxy_map[idx] = 0.0;
            fibrosisMap[idx] = conductivity;
          }
      }
    }

    // Prepara os mapas e tempos dos estímulos
    const stimulus_maps = [];
    const stimulus_timings = [];
    let cumulativeTime = 0;

    stimuli.forEach((stim, index) => {
      // define onde o estímulo será aplicado
      let map = new Uint8Array(N * N).fill(0);
      if (stim.shape === 'rectangle') { 
        const { x1, y1, x2, y2 } = stim.rectParams;
        const i1=Math.floor(y1/dy), j1=Math.floor(x1/dx), i2=Math.floor(y2/dy), j2=Math.floor(x2/dx);
        for (let i=Math.min(i1,i2); i<=Math.max(i1,i2); i++) for (let j=Math.min(j1,j2); j<=Math.max(j1,j2); j++) if (i>=0&&i<N&&j>=0&&j<N) map[i*N+j]=1;
      } else { 
        const { cx, cy, radius } = stim.circleParams;
        const rSq = radius*radius;
        for (let i=0; i<N; i++) for (let j=0; j<N; j++) if (((j*dx-cx)**2)+((i*dy-cy)**2)<=rSq) map[i*N+j]=1;
      }
      stimulus_maps.push(map);
      
      let startTime = (index === 0) ? stim.startTime : cumulativeTime + stim.interval;
      const endTime = startTime + stim.duration;
      cumulativeTime = endTime;
      
      stimulus_timings.push({ startTime, endTime, amplitude: stim.amplitude });
    });

    // Calcula o número total de passos da simulação
    const steps = Math.floor(totalTime / dt);
    
    // Prepara buffers para os resultados
    const expectedFrames = Math.floor(steps / downsamplingFactor) + 1;
    const framesBuffer = new Float32Array(expectedFrames * N * N); // V de todos os tempos
    const timesBuffer = new Float32Array(expectedFrames); // Tempos salvos
    
    let frameCount = 0;

    const inv_4dx2 = 1.0 / (4.0 * dx * dx);
    const inv_dx2 = 1.0 / (dx * dx);

    // Intervalo da barra de progresso
    const progressInterval = Math.max(1, Math.floor(steps / 100));

    // Tempo de início
    const startTimeReal = performance.now();

    // Loop da simulação
    for (let t = 0; t < steps; t++) {
        // Envia atualização de progresso
        if (t % progressInterval === 0) {
            const progress = Math.round((t / steps) * 100);
            
            // Estimativa de tempo
            let remaining = 0;
            if (t > 0) {
                const elapsed = performance.now() - startTimeReal; // Tempo passado
                const rate = elapsed / t; // ms por passo
                const remainingSteps = steps - t;
                remaining = remainingSteps * rate; // Estimativa de tempo restante
            }

            self.postMessage({ type: 'progress', value: progress, remaining });
        }

        const v_prev = new Float32Array(v);
        const h_prev = new Float32Array(h);
        const currentTime = t * dt;
        
        let stimulus_amplitude = 0;
        let current_stimulus_map = null;

        // Verifica qual estímulo está ativo
        for(let i = 0; i < stimulus_timings.length; i++) {
          const timing = stimulus_timings[i];
          if(currentTime >= timing.startTime && currentTime < timing.endTime) {
            stimulus_amplitude = timing.amplitude;
            current_stimulus_map = stimulus_maps[i];
            break;
          }
        }
        
        // Cálculo numérico
        for (let i = 1; i < N - 1; i++) {
            for (let j = 1; j < N - 1; j++) {
                const idx = i * N + j;

                // Pega os valores da célula no passo anterior
                const vp = v_prev[idx];
                const hp = h_prev[idx];
                
                // Pega o tensor local
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

                // Euler para v com Tensor de Difusão
                const d2v_dx2 = (v_prev[idx - 1] - 2 * vp + v_prev[idx + 1]) * inv_dx2;
                const d2v_dy2 = (v_prev[idx - N] - 2 * vp + v_prev[idx + N]) * inv_dx2;
                
                const v_dr = v_prev[idx + N + 1];
                const v_dl = v_prev[idx + N - 1];
                const v_ur = v_prev[idx - N + 1];
                const v_ul = v_prev[idx - N - 1];
                
                const d2v_dxdy = (v_dr - v_dl - v_ur + v_ul) * inv_4dx2;

                // Laplaciano
                const lap_v_anisotropic = (Dxx * d2v_dx2) + (Dyy * d2v_dy2) + (2 * Dxy * d2v_dxdy);
                
                // Reação
                const J_in = (hp * vp * vp * (1 - vp)) / Tau_in;
                const J_out = -vp / Tau_out;
                
                // Atualiza v
                v[idx] = vp + dt * (lap_v_anisotropic + J_in + J_out + stimulus);

                // Garante que os valores de v e h fiquem entre 0 e 1
                v[idx] = Math.max(0.0, Math.min(1.0, v[idx]));
                h[idx] = Math.max(0.0, Math.min(1.0, h[idx]));
            }
        }
        
        // Condições de contorno
        for (let i = 0; i < N; i++) {
            v[i*N] = v[i*N+1]; v[i*N+N-1] = v[i*N+N-2];
            h[i*N] = h[i*N+1]; h[i*N+N-1] = h[i*N+N-2];
        }
        for (let j = 0; j < N; j++) {
            v[j] = v[N+j]; v[(N-1)*N+j] = v[(N-2)*N+j];
            h[j] = h[N+j]; h[(N-1)*N+j] = h[(N-2)*N+j];
        }

        // Downsampling
        if (t % downsamplingFactor === 0) {
            framesBuffer.set(v, frameCount * N * N);
            timesBuffer[frameCount] = currentTime;
            frameCount++;
        }
    }

    // Envia os resultados de volta
    self.postMessage(
        { 
            type: 'result', 
            frames: framesBuffer, 
            times: timesBuffer,
            fibrosis: fibrosisMap,
            N,
            totalFrames: frameCount
        }, 
        [framesBuffer.buffer, timesBuffer.buffer, fibrosisMap.buffer]
    );
};