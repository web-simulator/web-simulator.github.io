class SeededRandom {
  constructor(seed = Date.now()) {
    this.seed = seed % 2147483647;
    if (this.seed <= 0) this.seed += 2147483646;
  }
  next() {
    this.seed = (this.seed * 16807) % 2147483647;
    return this.seed / 2147483647;
  }
  nextInt(min, max) {
    if (min > max) [min, max] = [max, min];
    return Math.floor(this.next() * (max - min + 1)) + min;
  }
}

// Constantes comuns do Minimal Model
const COMMON_MINIMAL = {
  u_o: 0.0,
  theta_v: 0.3,
  theta_w: 0.13,
  tau_vplus: 1.4506,
  tau_s1: 2.7342,
  k_s: 2.0994,
  u_s: 0.9087
};

self.onmessage = (e) => {
  const params = e.data;
  
  const { 
    sigma_l, sigma_t, angle, 
    L, N,
    totalTime, downsamplingFactor, 
    stimuli, fibrosisParams, transmuralityParams,
    cellType,
    minimalCellParams
  } = params;
  
  let { dt } = params;

  const dx = L / N;
  const dy = dx;
  const size = N * N;

  // Configuração do Tensor de Difusão
  const rad = (angle * Math.PI) / 180.0;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  const c2 = c * c;
  const s2 = s * s;
  const cs = c * s;

  const base_Dxx = sigma_l * c2 + sigma_t * s2;
  const base_Dyy = sigma_l * s2 + sigma_t * c2;
  const base_Dxy = (sigma_l - sigma_t) * cs;

  // Condição CFL
  const max_D = Math.max(base_Dxx, base_Dyy);
  const cfl_denominator = 4 * max_D + 2 * Math.abs(base_Dxy);
  const cfl_limit = (dx * dx) / (cfl_denominator || 1);
  if (dt > cfl_limit) dt = cfl_limit * 0.9;

  // Variáveis do minimal model
  let u = new Float32Array(size).fill(0.0);
  let v_gate = new Float32Array(size).fill(1.0);
  let w_gate = new Float32Array(size).fill(1.0);
  let s_gate = new Float32Array(size).fill(0.0);

  // Mapas de difusão
  let Dxx_map = new Float32Array(size).fill(base_Dxx);
  let Dyy_map = new Float32Array(size).fill(base_Dyy);
  let Dxy_map = new Float32Array(size).fill(base_Dxy);
  
  // Mapa de fibrose
  let fibrosisMap = new Float32Array(size).fill(sigma_l);

  // Geração da Fibrose
  if (fibrosisParams && fibrosisParams.enabled) {
    const { conductivity, type, distribution, shape, rectParams, circleParams, regionParams, borderZone = 0, seed, density } = fibrosisParams;
    const lerp = (start, end, t) => start * (1 - t) + end * t;

    if (type === 'compact' && distribution === 'region') {
      if (shape === 'rectangle') {
        const { x1, y1, x2, y2 } = rectParams;
        const rx_min = Math.min(x1, x2), rx_max = Math.max(x1, x2);
        const ry_min = Math.min(y1, y2), ry_max = Math.max(y1, y2);
        
        const search_min_x = rx_min - borderZone, search_max_x = rx_max + borderZone;
        const search_min_y = ry_min - borderZone, search_max_y = ry_max + borderZone;

        const i_start = Math.max(0, Math.floor(search_min_y / dy));
        const i_end = Math.min(N - 1, Math.floor(search_max_y / dy));
        const j_start = Math.max(0, Math.floor(search_min_x / dx));
        const j_end = Math.min(N - 1, Math.floor(search_max_x / dx));

        for (let i = i_start; i <= i_end; i++) {
          for (let j = j_start; j <= j_end; j++) {
            const y = i * dy; const x = j * dx;
            const idx = i * N + j;
            
            const dx_dist = Math.max(rx_min - x, 0, x - rx_max);
            const dy_dist = Math.max(ry_min - y, 0, y - ry_max);
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
      } else {
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
        const regionArea = (Math.abs(x2 - x1) * Math.abs(y2 - y1));
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

  // Preparação de Estímulos
  const stimulus_maps = [];
  const stimulus_timings = [];
  let cumulativeTime = 0;

  stimuli.forEach((stim, index) => {
    let map = new Uint8Array(size).fill(0);
    if (stim.shape === 'rectangle') {
      const { x1, y1, x2, y2 } = stim.rectParams;
      const i1 = Math.floor(y1/dy), j1 = Math.floor(x1/dx), i2 = Math.floor(y2/dy), j2 = Math.floor(x2/dx);
      for (let i=Math.min(i1,i2); i<=Math.max(i1,i2); i++) 
        for (let j=Math.min(j1,j2); j<=Math.max(j1,j2); j++) 
          if (i>=0 && i<N && j>=0 && j<N) map[i*N+j]=1;
    } else {
      const { cx, cy, radius } = stim.circleParams;
      const rSq = radius * radius;
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

  // Buffers de Saída
  const steps = Math.floor(totalTime / dt);
  const expectedFrames = Math.floor(steps / downsamplingFactor) + 1;
  const framesBuffer = new Float32Array(expectedFrames * size);
  const timesBuffer = new Float32Array(expectedFrames);
  
  let frameCount = 0;
  const inv_dx2 = 1.0 / (dx * dx);
  const inv_4dx2 = 1.0 / (4.0 * dx * dx);
  const progressInterval = Math.max(1, Math.floor(steps / 100));
  const startTimeReal = performance.now();

  const { u_o, theta_v, theta_w, tau_vplus, tau_s1, k_s, u_s } = COMMON_MINIMAL;

  // Seleção de parâmetros celulares
  const useTransmurality = transmuralityParams && transmuralityParams.enabled;
  let singleCellParams = null;
  if (!useTransmurality) {
    singleCellParams = minimalCellParams[cellType] || minimalCellParams.epi;
  }

  // Loop Temporal
  for (let t = 0; t < steps; t++) {
    if (t % progressInterval === 0) {
      const progress = Math.round((t / steps) * 100);
      let remaining = 0;
      if (t > 0) {
        const elapsed = performance.now() - startTimeReal;
        remaining = (steps - t) * (elapsed / t);
      }
      self.postMessage({ type: 'progress', value: progress, remaining });
    }

    // Variaveis anteriores
    const u_prev = new Float32Array(u); 
    const h_prev = new Float32Array(v_gate);
    const w_prev = new Float32Array(w_gate);
    const s_prev = new Float32Array(s_gate);

    const currentTime = t * dt;
    let stim_amp = 0;
    let stim_map = null;

    for (let i = 0; i < stimulus_timings.length; i++) {
      const timing = stimulus_timings[i];
      if (currentTime >= timing.startTime && currentTime < timing.endTime) {
        stim_amp = timing.amplitude;
        stim_map = stimulus_maps[i];
        break;
      }
    }

    // Loop Espacial
    for (let i = 1; i < N - 1; i++) {
      for (let j = 1; j < N - 1; j++) {
        const idx = i * N + j;
        
        // Caso tenha transmuralidade
        let p;
        if (useTransmurality) {
            const ratio = j / N; 
            const midStart = transmuralityParams.mid_start / 100.0;
            const epiStart = transmuralityParams.epi_start / 100.0;
            if (ratio < midStart) p = minimalCellParams.endo;
            else if (ratio < epiStart) p = minimalCellParams.myo;
            else p = minimalCellParams.epi;
        } else {
            p = singleCellParams;
        }

        // Variáveis locais
        const val_u = u_prev[idx];
        const val_v = h_prev[idx];
        const val_w = w_prev[idx];
        const val_s = s_prev[idx];

        // Difusão
        const Dxx = Dxx_map[idx];
        const Dyy = Dyy_map[idx];
        const Dxy = Dxy_map[idx];

        const d2u_dx2 = (u_prev[idx - 1] - 2 * val_u + u_prev[idx + 1]) * inv_dx2;
        const d2u_dy2 = (u_prev[idx - N] - 2 * val_u + u_prev[idx + N]) * inv_dx2;
        const d2u_dxdy = (u_prev[idx+N+1] - u_prev[idx+N-1] - u_prev[idx-N+1] + u_prev[idx-N-1]) * inv_4dx2;

        const lap_u = (Dxx * d2u_dx2) + (Dyy * d2u_dy2) + (2 * Dxy * d2u_dxdy);
        const stimulus = stim_map ? stim_map[idx] * stim_amp : 0;

        // Atualizações das variáveis
        const H_u_thv = (val_u - theta_v) > 0 ? 1.0 : 0.0;
        const H_u_thw = (val_u - theta_w) > 0 ? 1.0 : 0.0;
        const H_u_thv_minus = (val_u - p.theta_vminus) > 0 ? 1.0 : 0.0;
        const H_u_tho = (val_u - p.theta_o) > 0 ? 1.0 : 0.0;

        const tau_vminus = (1.0 - H_u_thv_minus) * p.tau_v1minus + H_u_thv_minus * p.tau_v2minus;
        const tau_wminus = p.tau_w1minus + (p.tau_w2minus - p.tau_w1minus) * (1.0 + Math.tanh(p.k_wminus * (val_u - p.u_wminus))) * 0.5;
        const tau_so = p.tau_so1 + (p.tau_so2 - p.tau_so1) * (1.0 + Math.tanh(p.k_so * (val_u - p.u_so))) * 0.5;
        const tau_s = (1.0 - H_u_thw) * tau_s1 + H_u_thw * p.tau_s2;
        const tau_o = (1.0 - H_u_tho) * p.tau_o1 + H_u_tho * p.tau_o2;

        const J_fi = -val_v * H_u_thv * (val_u - theta_v) * (p.u_u - val_u) / p.tau_fi;
        const J_so = (val_u - u_o) * (1.0 - H_u_thw) / tau_o + H_u_thw / tau_so;
        const J_si = -H_u_thw * val_w * val_s / p.tau_si;

        // Euler para u
        u[idx] = val_u + dt * (lap_u - (J_fi + J_so + J_si) + stimulus);

        // Rush-Larsen para v
        const v_inf = (val_u < p.theta_vminus) ? 1.0 : 0.0;
        const tau_v_rl = (tau_vplus * tau_vminus) / (tau_vplus - tau_vplus * H_u_thv + tau_vminus * H_u_thv);
        const v_inf_rl = (tau_vplus * v_inf * (1 - H_u_thv)) / (tau_vplus - tau_vplus * H_u_thv + tau_vminus * H_u_thv);
        
        if (tau_v_rl > 1e-10) {
            v_gate[idx] = v_inf_rl + (val_v - v_inf_rl) * Math.exp(-dt / tau_v_rl);
        } else {
            v_gate[idx] = val_v;
        }

        // Rush-Larsen para w
        const w_inf = (1.0 - H_u_tho) * (1.0 - val_u / p.tau_winf) + H_u_tho * p.w_infstar;
        const tau_w_rl = (p.tau_wplus * tau_wminus) / (p.tau_wplus - p.tau_wplus * H_u_thw + tau_wminus * H_u_thw);
        const w_inf_rl = (p.tau_wplus * w_inf * (1 - H_u_thw)) / (p.tau_wplus - p.tau_wplus * H_u_thw + tau_wminus * H_u_thw);

        if (tau_w_rl > 1e-10) {
            w_gate[idx] = w_inf_rl + (val_w - w_inf_rl) * Math.exp(-dt / tau_w_rl);
        } else {
            w_gate[idx] = val_w;
        }

        // Rush-Larsen para s
        const s_inf_rl = (1.0 + Math.tanh(k_s * (val_u - u_s))) * 0.5;
        if (tau_s > 1e-10) {
            s_gate[idx] = s_inf_rl + (val_s - s_inf_rl) * Math.exp(-dt / tau_s);
        } else {
            s_gate[idx] = val_s;
        }

        // Limita u entre 0 e 2
        if (u[idx] < 0) u[idx] = 0;
        if (u[idx] > 2.0) u[idx] = 2.0;
      }
    }

    // Condições de contorno
    for (let i = 0; i < N; i++) {
        u[i*N] = u[i*N+1]; u[i*N+N-1] = u[i*N+N-2];
    }
    for (let j = 0; j < N; j++) {
        u[j] = u[N+j]; u[(N-1)*N+j] = u[(N-2)*N+j];
    }

    if (t % downsamplingFactor === 0) {
      framesBuffer.set(u, frameCount * size);
      timesBuffer[frameCount] = currentTime;
      frameCount++;
    }
  }

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