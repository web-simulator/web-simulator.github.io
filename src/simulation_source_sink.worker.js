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

// Constantes do minimal model
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
    modelType,
    sigma_l, sigma_t, fiber_angle, 
    L, dx, totalTime, downsamplingFactor, stimuli, 
    obstacleParams, slitParams, fibrosisParams
  } = params;

  const { Tau_in, Tau_out, Tau_open, Tau_close, gate } = params;
  const { cellType, minimalCellParams } = params;

  let { dt } = params;
  
  const N = Math.floor(L / dx);
  const dy = dx;
  
  const rad = (fiber_angle * Math.PI) / 180.0;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  const c2 = c * c;
  const s2 = s * s;
  const cs = c * s;

  const base_Dxx = sigma_l * c2 + sigma_t * s2;
  const base_Dyy = sigma_l * s2 + sigma_t * c2;
  const base_Dxy = (sigma_l - sigma_t) * cs;

  const max_D = Math.max(base_Dxx, base_Dyy);
  const cfl_denominator = 4 * max_D + 2 * Math.abs(base_Dxy);
  const cfl_limit = (dx * dx) / (cfl_denominator || 1); 
  
  if (dt > cfl_limit) dt = cfl_limit * 0.9;

  // V e H iniciais
  let v_arr = new Float32Array(N * N).fill(0.0);
  let h_arr = new Float32Array(N * N).fill(1.0);
  
  // W e S
  let w_arr, s_arr;
  if (modelType === 'minimal') {// Só preenche se for minimal
      w_arr = new Float32Array(N * N).fill(1.0);
      s_arr = new Float32Array(N * N).fill(0.0);
  }
  
  // Mapas de Difusão e Geometria
  let Dxx_map = new Float32Array(N * N).fill(base_Dxx);
  let Dyy_map = new Float32Array(N * N).fill(base_Dyy);
  let Dxy_map = new Float32Array(N * N).fill(base_Dxy);
  let geometryMap = new Float32Array(N * N).fill(1.0); 

  // lida com a fibrose
  if (fibrosisParams && fibrosisParams.enabled) {
      const { conductivity, type, distribution, shape, rectParams, circleParams, regionParams, borderZone = 0, seed, density } = fibrosisParams;
      const lerp = (start, end, t) => start * (1 - t) + end * t;
      const size = N * N;
  
      if (type === 'compact' && distribution === 'region') {
        if (shape === 'rectangle') {
          const { x1, y1, x2, y2 } = rectParams;
          const rx_min = Math.min(x1, x2), rx_max = Math.max(x1, x2);
          const ry_min = Math.min(y1, y2), ry_max = Math.max(y1, y2);
          
          const i_start = Math.max(0, Math.floor((ry_min - borderZone) / dy));
          const i_end = Math.min(N - 1, Math.floor((ry_max + borderZone) / dy));
          const j_start = Math.max(0, Math.floor((rx_min - borderZone) / dx));
          const j_end = Math.min(N - 1, Math.floor((rx_max + borderZone) / dx));
  
          for (let i = i_start; i <= i_end; i++) {
            for (let j = j_start; j <= j_end; j++) {
              const y = i * dy; const x = j * dx;
              const idx = i * N + j;
              
              const dx_dist = Math.max(rx_min - x, 0, x - rx_max);
              const dy_dist = Math.max(ry_min - y, 0, y - ry_max);
              const distance = Math.sqrt(dx_dist * dx_dist + dy_dist * dy_dist);
  
              if (distance === 0) { // Dentro
                Dxx_map[idx] = conductivity; Dyy_map[idx] = conductivity; Dxy_map[idx] = 0.0;
                geometryMap[idx] = conductivity; 
              } else if (distance <= borderZone) {
                const t = distance / borderZone;
                Dxx_map[idx] = lerp(conductivity, base_Dxx, t);
                Dyy_map[idx] = lerp(conductivity, base_Dyy, t);
                Dxy_map[idx] = lerp(0.0, base_Dxy, t);
                geometryMap[idx] = lerp(conductivity, 1.0, t);
              }
            }
          }
        } else {
          // círculo
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
                geometryMap[idx] = conductivity;
              } else if (dist <= totalRadius) {
                const t = (dist - radius) / borderZone;
                Dxx_map[idx] = lerp(conductivity, base_Dxx, t);
                Dyy_map[idx] = lerp(conductivity, base_Dyy, t);
                Dxy_map[idx] = lerp(0.0, base_Dxy, t);
                geometryMap[idx] = lerp(conductivity, 1.0, t);
              }
            }
          }
        }
      } else { 
        // difusa ou compacta aleatória
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
          geometryMap[idx] = conductivity;
          generated++;
        }
      }
    }

  // Coloca o istmo
  const { cx, cy, radius } = obstacleParams;
  const { widthStart, widthEnd } = slitParams;
  const rSq = radius * radius;
  const y_min = cy - radius;
  const y_max = cy + radius;
  const height = y_max - y_min;

  for (let i = 0; i < N; i++) { 
      for (let j = 0; j < N; j++) {
          const idx = i * N + j;
          const y = i * dx; 
          const x = j * dx;
          
          let isTissue = true; 

          const distSq = (x - cx)**2 + (y - cy)**2;
          
          // Se estiver dentro do raio do obstáculo, verifica se cai na fenda
          if (distSq <= rSq) {
              const t_y = Math.max(0, Math.min(1, (y - y_min) / height));
              const currentWidth = widthStart + t_y * (widthEnd - widthStart);
              const halfWidth = currentWidth / 2.0;
              
              // Se estiver dentro da largura da fenda, é tecido. Senão é  obstáculo
              if (x >= (cx - halfWidth) && x <= (cx + halfWidth)) {
                  isTissue = true; 
              } else {
                  isTissue = false; 
              }
          }

          if (!isTissue) {
              Dxx_map[idx] = 0.0;
              Dyy_map[idx] = 0.0;
              Dxy_map[idx] = 0.0;
              geometryMap[idx] = 0.0; // 0.0 indica obstáculo
          }
      }
  }

  // Prepara os mapas onde os estímulos serão aplicados
  const stimulus_maps = [];
  const stimulus_timings = [];
  let cumulativeTime = 0;

  stimuli.forEach((stim, index) => {
    let map = new Uint8Array(N * N).fill(0);
    if (stim.shape === 'circle') {
        const { cx: sCx, cy: sCy, radius: sR } = stim.circleParams;
        const sRSq = sR * sR;
        for (let i = 0; i < N; i++) {
            for (let j = 0; j < N; j++) {
                const y = i * dx;
                const x = j * dx;
                if (((x - sCx)**2 + (y - sCy)**2) <= sRSq) {
                    if (geometryMap[i*N+j] > 0) map[i*N+j] = 1;
                }
            }
        }
    } 
    stimulus_maps.push(map);
    let startTime = (index === 0) ? stim.startTime : cumulativeTime + stim.interval;
    const endTime = startTime + stim.duration;
    cumulativeTime = endTime;
    stimulus_timings.push({ startTime, endTime, amplitude: stim.amplitude });
  });

  const steps = Math.floor(totalTime / dt);
  const expectedFrames = Math.floor(steps / downsamplingFactor) + 1;
  
  const framesBuffer = new Float32Array(expectedFrames * N * N); 
  const timesBuffer = new Float32Array(expectedFrames); 
  
  let frameCount = 0;
  const inv_4dx2 = 1.0 / (4.0 * dx * dx);
  const inv_dx2 = 1.0 / (dx * dx);
  const progressInterval = Math.max(1, Math.floor(steps / 100));
  const startTimeReal = performance.now();

  const { u_o, theta_v, theta_w, tau_vplus, tau_s1, k_s, u_s } = COMMON_MINIMAL;
  const p = (modelType === 'minimal') ? (minimalCellParams[cellType] || minimalCellParams.epi) : null;

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

      const v_prev = new Float32Array(v_arr);
      const h_prev = new Float32Array(h_arr);
      const w_prev = (modelType === 'minimal') ? new Float32Array(w_arr) : null;
      const s_prev = (modelType === 'minimal') ? new Float32Array(s_arr) : null;

      const currentTime = t * dt;
      let stimulus_amplitude = 0;
      let current_stimulus_map = null;

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
                  v_arr[idx] = -0.1; 
                  continue; 
              }

              const vp = v_prev[idx]; 
              const hp = h_prev[idx]; 
              
              const Dxx = Dxx_map[idx];
              const Dyy = Dyy_map[idx];
              const Dxy = Dxy_map[idx];
              
              const stimulus = current_stimulus_map ? current_stimulus_map[idx] * stimulus_amplitude : 0;

              const d2v_dx2 = (v_prev[idx - 1] - 2 * vp + v_prev[idx + 1]) * inv_dx2;
              const d2v_dy2 = (v_prev[idx - N] - 2 * vp + v_prev[idx + N]) * inv_dx2;
              const d2v_dxdy = (v_prev[idx + N + 1] - v_prev[idx + N - 1] - v_prev[idx - N + 1] + v_prev[idx - N - 1]) * inv_4dx2;

              const lap_v_anisotropic = (Dxx * d2v_dx2) + (Dyy * d2v_dy2) + (2 * Dxy * d2v_dxdy);

              if (modelType === 'ms') {
                  // Mitchell-Schaeffer
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
                    h_arr[idx] = h_inf + (hp - h_inf) * h_exp;
                  } 

                  const J_in = (hp * vp * vp * (1 - vp)) / Tau_in;
                  const J_out = -vp / Tau_out;
                  
                  v_arr[idx] = vp + dt * (lap_v_anisotropic + J_in + J_out + stimulus);
                  v_arr[idx] = Math.max(0.0, Math.min(1.0, v_arr[idx]));
                  h_arr[idx] = Math.max(0.0, Math.min(1.0, h_arr[idx]));

              } else {
                  // Minimal Model
                  const wp = w_prev[idx];
                  const sp = s_prev[idx];

                  const H_u_thv = (vp - theta_v) > 0 ? 1.0 : 0.0;
                  const H_u_thw = (vp - theta_w) > 0 ? 1.0 : 0.0;
                  const H_u_thv_minus = (vp - p.theta_vminus) > 0 ? 1.0 : 0.0;
                  const H_u_tho = (vp - p.theta_o) > 0 ? 1.0 : 0.0;

                  const tau_vminus = (1.0 - H_u_thv_minus) * p.tau_v1minus + H_u_thv_minus * p.tau_v2minus;
                  const tau_wminus = p.tau_w1minus + (p.tau_w2minus - p.tau_w1minus) * (1.0 + Math.tanh(p.k_wminus * (vp - p.u_wminus))) * 0.5;
                  const tau_so = p.tau_so1 + (p.tau_so2 - p.tau_so1) * (1.0 + Math.tanh(p.k_so * (vp - p.u_so))) * 0.5;
                  const tau_s = (1.0 - H_u_thw) * tau_s1 + H_u_thw * p.tau_s2;
                  const tau_o = (1.0 - H_u_tho) * p.tau_o1 + H_u_tho * p.tau_o2;

                  const J_fi = -hp * H_u_thv * (vp - theta_v) * (p.u_u - vp) / p.tau_fi;
                  const J_so = (vp - u_o) * (1.0 - H_u_thw) / tau_o + H_u_thw / tau_so;
                  const J_si = -H_u_thw * wp * sp / p.tau_si;

                  v_arr[idx] = vp + dt * (lap_v_anisotropic - (J_fi + J_so + J_si) + stimulus);

                  const v_inf = (vp < p.theta_vminus) ? 1.0 : 0.0;
                  const tau_v_rl = (tau_vplus * tau_vminus) / (tau_vplus - tau_vplus * H_u_thv + tau_vminus * H_u_thv);
                  const v_inf_rl = (tau_vplus * v_inf * (1 - H_u_thv)) / (tau_vplus - tau_vplus * H_u_thv + tau_vminus * H_u_thv);
                  
                  if (tau_v_rl > 1e-10) {
                      h_arr[idx] = v_inf_rl + (hp - v_inf_rl) * Math.exp(-dt / tau_v_rl);
                  } else {
                      h_arr[idx] = hp;
                  }

                  const w_inf = (1.0 - H_u_tho) * (1.0 - vp / p.tau_winf) + H_u_tho * p.w_infstar;
                  const tau_w_rl = (p.tau_wplus * tau_wminus) / (p.tau_wplus - p.tau_wplus * H_u_thw + tau_wminus * H_u_thw);
                  const w_inf_rl = (p.tau_wplus * w_inf * (1 - H_u_thw)) / (p.tau_wplus - p.tau_wplus * H_u_thw + tau_wminus * H_u_thw);

                  if (tau_w_rl > 1e-10) {
                      w_arr[idx] = w_inf_rl + (wp - w_inf_rl) * Math.exp(-dt / tau_w_rl);
                  } else {
                      w_arr[idx] = wp;
                  }

                  const s_inf_rl = (1.0 + Math.tanh(k_s * (vp - u_s))) * 0.5;
                  if (tau_s > 1e-10) {
                      s_arr[idx] = s_inf_rl + (sp - s_inf_rl) * Math.exp(-dt / tau_s);
                  } else {
                      s_arr[idx] = sp;
                  }

                  if (v_arr[idx] < 0) v_arr[idx] = 0;
                  if (v_arr[idx] > 2.0) v_arr[idx] = 2.0;
              }
          }
      }
      
      for (let i = 0; i < N; i++) {
          if (geometryMap[i*N] > 0) v_arr[i*N] = v_arr[i*N+1];
          if (geometryMap[i*N+N-1] > 0) v_arr[i*N+N-1] = v_arr[i*N+N-2];
      }
      for (let j = 0; j < N; j++) {
          if (geometryMap[j] > 0) v_arr[j] = v_arr[N+j];
          if (geometryMap[(N-1)*N+j] > 0) v_arr[(N-1)*N+j] = v_arr[(N-2)*N+j];
      }

      // Downsampling
      if (t % downsamplingFactor === 0) {
          framesBuffer.set(v_arr, frameCount * N * N);
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