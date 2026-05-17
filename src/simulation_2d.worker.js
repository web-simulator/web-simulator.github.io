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
    if (min > max) [min, max] = [max, min];
    return Math.floor(this.next() * (max - min + 1)) + min;
  }
}

self.onmessage = (e) => {
  const params = e.data; 

    const { 
        sigma_l, sigma_t, angle, 
        Tau_in, Tau_out, Tau_open, Tau_close, gate, 
        L, N,
        totalTime, downsamplingFactor, 
        stimuli, fibrosisParams, transmuralityParams 
    } = params;
    
    let { dt } = params;
    
    const dx = L / N;
    const dy = dx;

    // Tensor de Difusão
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

    const size = N * N;
    let v = new Float32Array(size).fill(0.0);
    let h = new Float32Array(size).fill(1.0);

    let Dxx_map = new Float32Array(size).fill(base_Dxx);
    let Dyy_map = new Float32Array(size).fill(base_Dyy);
    let Dxy_map = new Float32Array(size).fill(base_Dxy);
    let fibrosisMap = new Float32Array(size).fill(sigma_l);

    // Geração de Fibrose
    if (fibrosisParams && fibrosisParams.enabled) {
      const { conductivity, type, distribution, shape, rectParams, circleParams, regionParams, borderZone = 0, seed, density } = fibrosisParams;

      const lerp = (a, b, t) => a + (b - a) * t;

      if (type === 'compact' && distribution === 'region') {
          if (shape === 'rectangle') {
              const { x1, y1, x2, y2 } = rectParams;
              const rx_min = Math.min(x1, x2), rx_max = Math.max(x1, x2);
              const ry_min = Math.min(y1, y2), ry_max = Math.max(y1, y2);

              const search_min_x = rx_min - borderZone;
              const search_max_x = rx_max + borderZone;
              const search_min_y = ry_min - borderZone;
              const search_max_y = ry_max + borderZone;

              const i_start = Math.max(0, Math.floor(search_min_y / dy));
              const i_end = Math.min(N - 1, Math.floor(search_max_y / dy));
              const j_start = Math.max(0, Math.floor(search_min_x / dx));
              const j_end = Math.min(N - 1, Math.floor(search_max_x / dx));

              for (let i = i_start; i <= i_end; i++) {
                  for (let j = j_start; j <= j_end; j++) {
                      const y = i * dy; const x = j * dx;
                      const idx = i * N + j;

                      // calcula a distância do ponto até o retângulo
                      const dx_dist = Math.max(rx_min - x, 0, x - rx_max);
                      const dy_dist = Math.max(ry_min - y, 0, y - ry_max);
                      
                      // Distância até a borda do retângulo
                      const distance = Math.sqrt(dx_dist * dx_dist + dy_dist * dy_dist);

                      if (distance === 0) {
                          Dxx_map[idx] = conductivity; Dyy_map[idx] = conductivity; Dxy_map[idx] = 0.0;
                          fibrosisMap[idx] = conductivity;
                      } else if (distance <= borderZone) {
                          const t = distance / borderZone;
                          Dxx_map[idx] = lerp(conductivity, base_Dxx, t);
                          Dyy_map[idx] = lerp(conductivity, base_Dyy, t);
                          Dxy_map[idx] = lerp(0.0, base_Dxy, t);
                          fibrosisMap[idx] = lerp(conductivity, sigma_l, t);
                      }
                  }
              }
          } else if (shape === 'circle') {
              const { cx, cy, radius } = circleParams;
              const totalRadius = radius + borderZone;

              const i_start = Math.max(0, Math.floor((cy - totalRadius) / dy));
              const i_end = Math.min(N - 1, Math.floor((cy + totalRadius) / dy));
              const j_start = Math.max(0, Math.floor((cx - totalRadius) / dx));
              const j_end = Math.min(N - 1, Math.floor((cx + totalRadius) / dx));

              for (let i = i_start; i <= i_end; i++) {
                  for (let j = j_start; j <= j_end; j++) {
                      const y = i * dy; const x = j * dx;
                      const idx = i * N + j;

                      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);

                      if (dist <= radius) {
                          Dxx_map[idx] = conductivity; Dyy_map[idx] = conductivity; Dxy_map[idx] = 0.0;
                          fibrosisMap[idx] = conductivity;
                      } else if (dist <= totalRadius) {
                          const t = (dist - radius) / borderZone;
                          Dxx_map[idx] = lerp(conductivity, base_Dxx, t);
                          Dyy_map[idx] = lerp(conductivity, base_Dyy, t);
                          Dxy_map[idx] = lerp(0.0, base_Dxy, t);
                          fibrosisMap[idx] = lerp(conductivity, sigma_l, t);
                      }
                  }
              }
          }
      } else {
          const random = new SeededRandom(seed);
          let numRegions, i_min, i_max, j_min, j_max;
          const pixelArea = dx * dy;

          if (type === 'diffuse' && regionParams) {
              const { x1, y1, x2, y2 } = regionParams;
              i_min = Math.floor(Math.min(y1, y2) / dy);
              i_max = Math.floor(Math.max(y1, y2) / dy);
              j_min = Math.floor(Math.min(x1, x2) / dx);
              j_max = Math.floor(Math.max(x1, x2) / dx);
              const regionArea = Math.abs(x2 - x1) * Math.abs(y2 - y1);
              numRegions = Math.ceil((regionArea * density) / pixelArea);
          } else {
              i_min = 0; i_max = N - 1; j_min = 0; j_max = N - 1;
              numRegions = Math.ceil(((L * L) * density) / pixelArea);
          }

          i_min = Math.max(0, i_min); i_max = Math.min(N - 1, i_max);
          j_min = Math.max(0, j_min); j_max = Math.min(N - 1, j_max);

          let generated = 0, attempts = 0;
          while (generated < numRegions && attempts < numRegions * 5) {
              attempts++;
              const centerRow = random.nextInt(i_min, i_max);
              const centerCol = random.nextInt(j_min, j_max);
              const idx = centerRow * N + centerCol;
              Dxx_map[idx] = conductivity; Dyy_map[idx] = conductivity; Dxy_map[idx] = 0.0;
              fibrosisMap[idx] = conductivity;
              generated++;
          }
      }
    }

    // Condição de CFL
    let max_D = Math.max(base_Dxx, base_Dyy);
    if (fibrosisParams && fibrosisParams.enabled) {
      for (let i = 0; i < size; i++) {
        max_D = Math.max(max_D, Dxx_map[i], Dyy_map[i]);
      }
    }
    const cfl_denominator = 4 * max_D + 2 * Math.abs(base_Dxy);
    const cfl_limit = (dx * dx) / (cfl_denominator || 1);

    if (dt > cfl_limit) dt = cfl_limit * 0.9;

    // Preparação dos Estímulos
    const stimulus_maps = [];
    const stimulus_timings = [];
    let cumulativeTime = 0;

    stimuli.forEach((stim, index) => {
      let map = new Uint8Array(size).fill(0);
      if (stim.shape === 'rectangle') { 
        const { x1, y1, x2, y2 } = stim.rectParams;
        const i1=Math.floor(y1/dy), j1=Math.floor(x1/dx), i2=Math.floor(y2/dy), j2=Math.floor(x2/dx);
        for (let i=Math.min(i1,i2); i<=Math.max(i1,i2); i++) 
            for (let j=Math.min(j1,j2); j<=Math.max(j1,j2); j++) 
                if (i>=0&&i<N&&j>=0&&j<N) map[i*N+j]=1;
      } else { 
        const { cx, cy, radius } = stim.circleParams;
        const rSq = radius*radius;
        for (let i=0; i<N; i++) 
            for (let j=0; j<N; j++) 
                if (((j*dx-cx)**2)+((i*dy-cy)**2)<=rSq) map[i*N+j]=1;
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
    const framesBuffer = new Float32Array(expectedFrames * size);
    const timesBuffer = new Float32Array(expectedFrames);
    
    // arrays para APD e LAT
    const activationTimes = []; 
    const apd = []; 
    const activationState = new Uint8Array(size).fill(0);
    const activationStartTime = new Float32Array(size).fill(-1);
    const activationCount = new Uint32Array(size).fill(0); // Conta quantas vezes a célula ativou
    let maxActivations = 0; // Controla quantos arrays de LAT/APD precisamos
    const activationThreshold = 0.3;

    let frameCount = 0;
    const inv_dx2 = 1.0 / (dx * dx);
    const inv_4dx2 = 1.0 / (4.0 * dx * dx);
    const progressInterval = Math.max(1, Math.floor(steps / 100));
    const startTimeReal = performance.now();

    // Loop da simulação
    for (let t = 0; t < steps; t++) {
        // Envia atualização de progresso
        if (t % progressInterval === 0) {
            const progress = Math.round((t / steps) * 100);
            
            // Estimativa de tempo
            let remaining = 0;
            if (t > 0) {
                const elapsed = performance.now() - startTimeReal;
                remaining = (steps - t) * (elapsed / t);
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
                
                // Transmuralidade
                let local_Tau_close = Tau_close;
                if (transmuralityParams && transmuralityParams.enabled) {
                    const ratio = j / N; 
                    const midStart = transmuralityParams.mid_start / 100.0;
                    const epiStart = transmuralityParams.epi_start / 100.0;
                    
                    if (ratio < midStart) local_Tau_close = transmuralityParams.endo_tau;
                    else if (ratio < epiStart) local_Tau_close = transmuralityParams.mid_tau;
                    else local_Tau_close = transmuralityParams.epi_tau;
                }

                // Rush-Larsen
                let alpha_h = (vp < gate) ? (1.0 / Tau_open) : 0.0;
                let beta_h = (vp < gate) ? 0.0 : (1.0 / local_Tau_close);
                
                const sum_ab = alpha_h + beta_h;
                if (sum_ab > 1e-10) {
                  const h_inf = alpha_h / sum_ab;
                  const h_exp = Math.exp(-sum_ab * dt);
                  h[idx] = h_inf + (hp - h_inf) * h_exp;
                } else {
                    h[idx] = hp;
                }

                // Laplaciano
                const d2v_dx2 = (v_prev[idx - 1] - 2 * vp + v_prev[idx + 1]) * inv_dx2;
                const d2v_dy2 = (v_prev[idx - N] - 2 * vp + v_prev[idx + N]) * inv_dx2;
                const d2v_dxdy = (v_prev[idx+N+1] - v_prev[idx+N-1] - v_prev[idx-N+1] + v_prev[idx-N-1]) * inv_4dx2;

                const lap_v = (Dxx * d2v_dx2) + (Dyy * d2v_dy2) + (2 * Dxy * d2v_dxdy);
                const J_in = (hp * vp * vp * (1 - vp)) / Tau_in;
                const J_out = -vp / Tau_out;
                
                // Atualiza V
                v[idx] = vp + dt * (lap_v + J_in + J_out + stimulus);
                
                // Limita os valores
                if (v[idx] < 0) v[idx] = 0;
                if (v[idx] > 1.5) v[idx] = 1.5;

                // Cálculo de LAT e APD
                const volt = v[idx];

                if (activationState[idx] === 0) { // Em repouso
                    if (volt >= activationThreshold) {
                        activationState[idx] = 1; // Ativado
                        activationStartTime[idx] = currentTime;
                        
                        let c = activationCount[idx];
                        activationCount[idx]++;
                        
                        if (c >= maxActivations) {
                            maxActivations++;
                            activationTimes.push(new Float32Array(size).fill(-1));
                            apd.push(new Float32Array(size).fill(-1));
                        }
                        activationTimes[c][idx] = currentTime;
                    }
                } else if (activationState[idx] === 1) { // Ativado
                    if (volt < activationThreshold) {
                        activationState[idx] = 2; // Recuperado
                        let c = activationCount[idx] - 1;
                        if (c >= 0 && apd[c]) {
                            apd[c][idx] = currentTime - activationStartTime[idx];
                        }
                    }
                } else if (activationState[idx] === 2) { 
                    if (volt < 0.1) {
                        activationState[idx] = 0;
                    }
                }
            }
        }
        
        // Condições de contorno
        for (let i = 0; i < N; i++) {
            v[i*N] = v[i*N+1]; 
            v[i*N+N-1] = v[i*N+N-2];
            h[i*N] = h[i*N+1]; 
            h[i*N+N-1] = h[i*N+N-2];

            activationState[i*N] = activationState[i*N+1]; 
            activationState[i*N+N-1] = activationState[i*N+N-2];
            activationStartTime[i*N] = activationStartTime[i*N+1]; 
            activationStartTime[i*N+N-1] = activationStartTime[i*N+N-2];
            activationCount[i*N] = activationCount[i*N+1];
            activationCount[i*N+N-1] = activationCount[i*N+N-2];

            for (let c = 0; c < maxActivations; c++) {
                activationTimes[c][i*N] = activationTimes[c][i*N+1];
                activationTimes[c][i*N+N-1] = activationTimes[c][i*N+N-2];
                apd[c][i*N] = apd[c][i*N+1];
                apd[c][i*N+N-1] = apd[c][i*N+N-2];
            }
        }
        for (let j = 0; j < N; j++) {
            v[j] = v[N+j]; 
            v[(N-1)*N+j] = v[(N-2)*N+j];
            h[j] = h[N+j]; 
            h[(N-1)*N+j] = h[(N-2)*N+j];

            activationState[j] = activationState[N+j]; 
            activationState[(N-1)*N+j] = activationState[(N-2)*N+j];
            activationStartTime[j] = activationStartTime[N+j]; 
            activationStartTime[(N-1)*N+j] = activationStartTime[(N-2)*N+j];
            activationCount[j] = activationCount[N+j];
            activationCount[(N-1)*N+j] = activationCount[(N-2)*N+j];

            for (let c = 0; c < maxActivations; c++) {
                activationTimes[c][j] = activationTimes[c][N+j];
                activationTimes[c][(N-1)*N+j] = activationTimes[c][(N-2)*N+j];
                apd[c][j] = apd[c][N+j];
                apd[c][(N-1)*N+j] = apd[c][(N-2)*N+j];
            }
        }

        // Downsampling
        if (t % downsamplingFactor === 0) {
            framesBuffer.set(v, frameCount * size);
            timesBuffer[frameCount] = currentTime;
            frameCount++;
        }
    }

    const transferList = [framesBuffer.buffer, timesBuffer.buffer, fibrosisMap.buffer];
    activationTimes.forEach(arr => transferList.push(arr.buffer));
    apd.forEach(arr => transferList.push(arr.buffer));

    // Envia os resultados de volta
    self.postMessage(
        { 
            type: 'result', 
            frames: framesBuffer, 
            times: timesBuffer,
            fibrosis: fibrosisMap,
            activationTimes,
            apd,
            N,
            totalFrames: frameCount
        }, 
        transferList
    );
};