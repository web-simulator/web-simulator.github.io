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

    // Parâmetros
    const { sigma_x, sigma_y, Tau_in, Tau_out, Tau_open, Tau_close, gate, L, dx, totalTime, downsamplingFactor, stimuli, fibrosisParams } = params;
    let { dt } = params;
    
    // Calcula o tamanho da malha
    const N = Math.floor(L / dx);
    const dy = dx; // A malha é quadrada

    // Condição de CFL para 2D anisotrópico
    const max_sigma = Math.max(sigma_x, sigma_y);
    const cfl_limit = (dx * dx) / (4 * max_sigma); 
    if (dt > cfl_limit) dt = cfl_limit * 0.9;

    // Arrays para V e h
    let v = new Float32Array(N * N).fill(0.0);
    let h = new Float32Array(N * N).fill(1.0);
    
    // Mapas de condutividade para X e Y separadamente
    let sigma_x_map = new Float32Array(N * N).fill(sigma_x);
    let sigma_y_map = new Float32Array(N * N).fill(sigma_y);
    
    // Mapa para renderizar a fibrose em preto
    let visual_k_map = new Float32Array(N * N).fill(sigma_x);

    if (fibrosisParams.enabled) {
      const { density, regionSize, seed, conductivity, type, regionParams } = fibrosisParams;
      const random = new SeededRandom(seed); // Usa a classe de números aleatórios
      
      let numRegions, i_min, i_max, j_min, j_max;

      if (type === 'difusa') {
        // fibrose difusa 
        const { x1, y1, x2, y2 } = regionParams;
        // Converte coordenadas para índices da malha
        i_min = Math.floor(Math.min(y1, y2) / dy);
        i_max = Math.floor(Math.max(y1, y2) / dy);
        j_min = Math.floor(Math.min(x1, x2) / dx);
        j_max = Math.floor(Math.max(x1, x2) / dx);

        // Calcula a área da região e o número de círculos de fibrose
        const regionArea = (Math.abs(x2 - x1) * Math.abs(y2 - y1));
        numRegions = Math.ceil((regionArea * density) / (Math.PI * regionSize * regionSize));

      } else {
        // fibrose compacta
        i_min = 0;
        i_max = N - 1;
        j_min = 0;
        j_max = N - 1;
        numRegions = Math.ceil(((L * L) * density) / (Math.PI * regionSize * regionSize));
      }

      const radiusInPixels = regionSize / dx;
      const radiusSq = radiusInPixels * radiusInPixels;

      for (let r = 0; r < numRegions; r++) {
        // Gera centros aleatórios dentro dos limites definidos
        const centerRow = random.nextInt(i_min, i_max);
        const centerCol = random.nextInt(j_min, j_max);

        const i_start = Math.max(0, centerRow - Math.floor(radiusInPixels));
        const i_end = Math.min(N - 1, centerRow + Math.ceil(radiusInPixels));
        const j_start = Math.max(0, centerCol - Math.floor(radiusInPixels));
        const j_end = Math.min(N - 1, centerCol + Math.ceil(radiusInPixels));

        for (let i = i_start; i <= i_end; i++) {
          for (let j = j_start; j <= j_end; j++) {
            const distanceSq = (i - centerRow) ** 2 + (j - centerCol) ** 2;
            if (distanceSq <= radiusSq) {
              const idx = i * N + j;
              // A condutividade da fibrose se sobrepõe a das outras direções
              sigma_x_map[idx] = conductivity;
              sigma_y_map[idx] = conductivity;
              visual_k_map[idx] = conductivity;
            }
          }
        }
      }
    }

    // Prepara os mapas e os tempos para cada estímulo na lista
    const stimulus_maps = [];
    const stimulus_timings = [];
    let cumulativeTime = 0;

    stimuli.forEach((stim, index) => {
      // define onde o estímulo será aplicado
      let map = new Uint8Array(N * N).fill(0);
      if (stim.shape === 'rectangle') { // Para estímulo retangular
        const { x1, y1, x2, y2 } = stim.rectParams;
        const i1=Math.floor(y1/dy), j1=Math.floor(x1/dx), i2=Math.floor(y2/dy), j2=Math.floor(x2/dx);
        for (let i=Math.min(i1,i2); i<=Math.max(i1,i2); i++) for (let j=Math.min(j1,j2); j<=Math.max(j1,j2); j++) if (i>=0&&i<N&&j>=0&&j<N) map[i*N+j]=1;
      } else { // Para estímulo circular
        const { cx, cy, radius } = stim.circleParams;
        const rSq = radius*radius;
        for (let i=0; i<N; i++) for (let j=0; j<N; j++) if (((j*dx-cx)**2)+((i*dy-cy)**2)<=rSq) map[i*N+j]=1;
      }
      stimulus_maps.push(map);
      
      // Calcula o tempo de início e fim de cada estímulo
      let startTime;
      if (index === 0) {
        startTime = stim.startTime; // O primeiro estímulo começa no tempo definido
      } else {
        startTime = cumulativeTime + stim.interval; // Os outros começam após o intervalo definido
      }
      const endTime = startTime + stim.duration;
      cumulativeTime = endTime;
      
      stimulus_timings.push({ startTime, endTime, amplitude: stim.amplitude });
    });

    // Calcula o número total de passos da simulação
    const steps = Math.floor(totalTime / dt);
    const outputData = []; // Resultados 

    // Loop da simulação
    for (let t = 0; t < steps; t++) {
        // Guarda uma cópia dos valores do passo anterior
        const v_prev = new Float32Array(v);
        const h_prev = new Float32Array(h);

        const currentTime = t * dt; // Tempo atual
        let stimulus_amplitude = 0;
        let current_stimulus_map = null;

        // Verifica qual estímulo está ativo no tempo atual
        for(let i = 0; i < stimulus_timings.length; i++) {
          const timing = stimulus_timings[i];
          if(currentTime >= timing.startTime && currentTime < timing.endTime) {
            stimulus_amplitude = timing.amplitude;
            current_stimulus_map = stimulus_maps[i];
            break;
          }
        }
        
        // Calcula os novos valores de v e h para cada célula
        for (let i = 1; i < N - 1; i++) {
            for (let j = 1; j < N - 1; j++) {
                const idx = i * N + j;

                // Pega os valores da célula no passo anterior
                const vp = v_prev[idx];
                const hp = h_prev[idx];
                
                // Pega a condutividade local para X e Y separadamente
                const local_sx = sigma_x_map[idx];
                const local_sy = sigma_y_map[idx];
                
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

                // Euler para v
          
                // Difusão em X: sigma_x * d2v/dx2
                const diff_x = local_sx * (v_prev[idx - 1] - 2 * vp + v_prev[idx + 1]) / (dx * dx);
                
                // Difusão em Y: sigma_y * d2v/dy2
                const diff_y = local_sy * (v_prev[idx - N] - 2 * vp + v_prev[idx + N]) / (dy * dy);
                
                const lap_v_anisotropic = diff_x + diff_y;
                
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
        
        // Condição de contorno
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
            const snapshot = Array(N).fill(0).map(() => Array(N).fill(0));
            const fibrosisSnapshot = Array(N).fill(0).map(() => Array(N).fill(0));
            for(let i = 0; i < N; i++) {
                for (let j = 0; j < N; j++) {
                    snapshot[i][j] = v[i * N + j];
                    fibrosisSnapshot[i][j] = visual_k_map[i * N + j];
                }
            }
            // Adiciona os dados do potencial e da fibrose ao array de resultados
            outputData.push({ time: (t * dt).toFixed(4), data: snapshot, fibrosisMap: fibrosisSnapshot });
        }
    }
    // Retorna os dados
    self.postMessage(outputData);

};