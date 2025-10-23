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
    return Math.floor(this.next() * (max - min + 1)) + min;
  }
}

self.onmessage = (e) => {
  const params = e.data; // Parâmetros enviados
  const { modelType } = params; // Tipo de modelo

    // Parâmetros
    const { k, Tau_in, Tau_out, Tau_open, Tau_close, gate, L, dx, totalTime, downsamplingFactor, stimuli, fibrosisParams } = params;
    let { dt } = params;
    
    // Calcula o tamanho da malha
    const N = Math.floor(L / dx);
    const dy = dx; // A malha é quadrada

    // Condição de CFL
    const cfl_limit = (dx * dx) / (4 * k);
    if (dt > cfl_limit) dt = cfl_limit * 0.9;

    // Arrays para V e h
    let v = new Float32Array(N * N).fill(0.0);
    let h = new Float32Array(N * N).fill(1.0);
    
    // condutividade de cada célula
    let k_map = new Float32Array(N * N).fill(k);
    
    // Mudanças para caso tenha fibrose
    if (fibrosisParams.enabled) {
      const { density, regionSize, seed, conductivity } = fibrosisParams;
      const random = new SeededRandom(seed); // Usa a classe de números aleatórios
      // Cria regiões circulares de fibrose em locais aleatórios
      const numRegions = Math.ceil(((L * L) * density) / (Math.PI * regionSize * regionSize));
      for (let r = 0; r < numRegions; r++) {
        const centerRow = random.nextInt(0, N - 1);
        const centerCol = random.nextInt(0, N - 1);
        const radiusInPixels = regionSize / dx;
        const radiusSq = radiusInPixels * radiusInPixels;

        for (let i = 0; i < N; i++) {
          for (let j = 0; j < N; j++) {
            const distanceSq = (i - centerRow) ** 2 + (j - centerCol) ** 2;
            if (distanceSq <= radiusSq) {
              k_map[i * N + j] = conductivity; // Define a condutividade da fibrose
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
                const local_k = k_map[idx]; // Pega a condutividade local
                const stimulus = current_stimulus_map ? current_stimulus_map[idx] * stimulus_amplitude : 0;

                // Calcula a difusão (interação com as células vizinhas)
                let lap_v = (v_prev[idx - N] + v_prev[idx + N] + v_prev[idx - 1] + v_prev[idx + 1] - 4 * vp) / (dx * dx);
                
                // RK4
                // K1
                let J_in = (hp * vp * vp * (1 - vp)) / Tau_in;
                let J_out = -vp / Tau_out;
                const k1_v = dt * (local_k * lap_v + J_in + J_out + stimulus);
                const k1_h = dt * ((vp < gate) ? (1 - hp) / Tau_open : -hp / Tau_close);

                // K2
                const v2 = vp + 0.5 * k1_v;
                const h2 = hp + 0.5 * k1_h;
                J_in = (h2 * v2 * v2 * (1 - v2)) / Tau_in;
                J_out = -v2 / Tau_out;
                const k2_v = dt * (local_k * lap_v + J_in + J_out + stimulus);
                const k2_h = dt * ((v2 < gate) ? (1 - h2) / Tau_open : -h2 / Tau_close);

                // K3
                const v3 = vp + 0.5 * k2_v;
                const h3 = hp + 0.5 * k2_h;
                J_in = (h3 * v3 * v3 * (1 - v3)) / Tau_in;
                J_out = -v3 / Tau_out;
                const k3_v = dt * (local_k * lap_v + J_in + J_out + stimulus);
                const k3_h = dt * ((v3 < gate) ? (1 - h3) / Tau_open : -h3 / Tau_close);

                // K4
                const v4 = vp + k3_v;
                const h4 = hp + k3_h;
                J_in = (h4 * v4 * v4 * (1 - v4)) / Tau_in;
                J_out = -v4 / Tau_out;
                const k4_v = dt * (local_k * lap_v + J_in + J_out + stimulus);
                const k4_h = dt * ((v4 < gate) ? (1 - h4) / Tau_open : -h4 / Tau_close);
                
                // Calcula o valor final de v e h para o passo atual
                v[idx] = vp + (1/6) * (k1_v + 2*k2_v + 2*k3_v + k4_v);
                h[idx] = hp + (1/6) * (k1_h + 2*k2_h + 2*k3_h + k4_h);

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
                    fibrosisSnapshot[i][j] = k_map[i * N + j];
                }
            }
            // Adiciona os dados do potencial e da fibrose ao array de resultados
            outputData.push({ time: (t * dt).toFixed(4), data: snapshot, fibrosisMap: fibrosisSnapshot });
        }
    }
    // Retorna os dados
    self.postMessage(outputData);

};