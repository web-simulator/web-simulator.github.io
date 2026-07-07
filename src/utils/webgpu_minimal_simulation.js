import { SeededRandom } from './webgpu_simulation';

const MINIMAL_SIMULATION_SHADER = `
  struct MinimalParams {
    u_o: f32, u_u: f32, theta_v: f32, theta_w: f32,
    theta_vminus: f32, theta_o: f32, tau_v1minus: f32, tau_v2minus: f32,
    tau_vplus: f32, tau_w1minus: f32, tau_w2minus: f32, k_wminus: f32,
    u_wminus: f32, tau_wplus: f32, tau_fi: f32, tau_o1: f32,
    tau_o2: f32, tau_so1: f32, tau_so2: f32, k_so: f32,
    u_so: f32, tau_s1: f32, tau_s2: f32, k_s: f32,
    u_s: f32, tau_si: f32, tau_winf: f32, w_infstar: f32
  };

  struct UniformParams {
    N: f32, dx: f32, dt: f32, use_transmurality: f32,
    mid_start: f32, epi_start: f32, pad1: f32, pad2: f32,
    p_endo: MinimalParams,
    p_myo: MinimalParams,
    p_epi: MinimalParams
  };

  @group(0) @binding(0) var<uniform> params: UniformParams;
  @group(0) @binding(1) var<storage, read> u_in: array<f32>;
  @group(0) @binding(2) var<storage, read_write> u_out: array<f32>;
  @group(0) @binding(3) var<storage, read> vws_in: array<vec4<f32>>;
  @group(0) @binding(4) var<storage, read_write> vws_out: array<vec4<f32>>;
  @group(0) @binding(5) var<storage, read> d_map: array<vec4<f32>>;
  @group(0) @binding(6) var<storage, read> stimulus_map: array<f32>;



  @compute @workgroup_size(16, 16)
  fn main(@builtin(global_invocation_id) id: vec3<u32>) {
    let n = u32(params.N);
    let j = id.x; 
    let i = id.y; 

    if (j >= n || i >= n) { return; }
    let idx = i * n + j;

    if (i == 0u || i == n - 1u || j == 0u || j == n - 1u) {
      var mirror_i = i; var mirror_j = j;
      if (i == 0u) { mirror_i = 1u; } else if (i == n - 1u) { mirror_i = n - 2u; }
      if (j == 0u) { mirror_j = 1u; } else if (j == n - 1u) { mirror_j = n - 2u; }
      
      let midx = mirror_i * n + mirror_j;
      u_out[idx] = u_in[midx];
      vws_out[idx] = vws_in[midx];
      return;
    }

    var p: MinimalParams;
    if (params.use_transmurality > 0.5) {
      let ratio = f32(j) / params.N;
      if (ratio < params.mid_start) {
        p = params.p_endo;
      } else if (ratio < params.epi_start) {
        p = params.p_myo;
      } else {
        p = params.p_epi;
      }
    } else {
      p = params.p_epi;
    }

    let val_u = u_in[idx];
    let vws_val = vws_in[idx];
    let val_v = vws_val.x;
    let val_w = vws_val.y;
    let val_s = vws_val.z;

    let d_val = d_map[idx];
    let Dxx = d_val.x; let Dyy = d_val.y; let Dxy = d_val.z;
    let stimulus = stimulus_map[idx];

    let inv_dx2 = 1.0 / (params.dx * params.dx);
    let inv_4dx2 = 1.0 / (4.0 * params.dx * params.dx);

    let d2u_dx2 = (u_in[idx - 1u] - 2.0 * val_u + u_in[idx + 1u]) * inv_dx2;
    let d2u_dy2 = (u_in[idx - n] - 2.0 * val_u + u_in[idx + n]) * inv_dx2;
    
    let u_dr = u_in[idx + n + 1u]; let u_dl = u_in[idx + n - 1u];
    let u_ur = u_in[idx - n + 1u]; let u_ul = u_in[idx - n - 1u];
    let d2u_dxdy = (u_dr - u_dl - u_ur + u_ul) * inv_4dx2;

    let lap_u = (Dxx * d2u_dx2) + (Dyy * d2u_dy2) + (2.0 * Dxy * d2u_dxdy);

    var H_u_thv: f32 = 0.0; if (val_u - p.theta_v > 0.0) { H_u_thv = 1.0; }
    var H_u_thw: f32 = 0.0; if (val_u - p.theta_w > 0.0) { H_u_thw = 1.0; }
    var H_u_thv_minus: f32 = 0.0; if (val_u - p.theta_vminus > 0.0) { H_u_thv_minus = 1.0; }
    var H_u_tho: f32 = 0.0; if (val_u - p.theta_o > 0.0) { H_u_tho = 1.0; }

    let tau_vminus = (1.0 - H_u_thv_minus) * p.tau_v1minus + H_u_thv_minus * p.tau_v2minus;
    let tau_wminus = p.tau_w1minus + (p.tau_w2minus - p.tau_w1minus) * (1.0 + tanh(p.k_wminus * (val_u - p.u_wminus))) * 0.5;
    let tau_so = p.tau_so1 + (p.tau_so2 - p.tau_so1) * (1.0 + tanh(p.k_so * (val_u - p.u_so))) * 0.5;
    let tau_s = (1.0 - H_u_thw) * p.tau_s1 + H_u_thw * p.tau_s2;
    let tau_o = (1.0 - H_u_tho) * p.tau_o1 + H_u_tho * p.tau_o2;

    let J_fi = -val_v * H_u_thv * (val_u - p.theta_v) * (p.u_u - val_u) / p.tau_fi;
    let J_so = (val_u - p.u_o) * (1.0 - H_u_thw) / tau_o + H_u_thw / tau_so;
    let J_si = -H_u_thw * val_w * val_s / p.tau_si;

    var u_next = val_u + params.dt * (lap_u - (J_fi + J_so + J_si) + stimulus);
    if (u_next < 0.0) { u_next = 0.0; }
    if (u_next > 2.0) { u_next = 2.0; }
    u_out[idx] = u_next;

    var v_inf: f32 = 0.0; if (val_u < p.theta_vminus) { v_inf = 1.0; }
    let tau_v_rl = (p.tau_vplus * tau_vminus) / (p.tau_vplus - p.tau_vplus * H_u_thv + tau_vminus * H_u_thv);
    let v_inf_rl = (p.tau_vplus * v_inf * (1.0 - H_u_thv)) / (p.tau_vplus - p.tau_vplus * H_u_thv + tau_vminus * H_u_thv);
    var v_next: f32;
    if (tau_v_rl > 1e-10) { v_next = v_inf_rl + (val_v - v_inf_rl) * exp(-params.dt / tau_v_rl); } else { v_next = val_v; }

    let w_inf = (1.0 - H_u_tho) * (1.0 - val_u / p.tau_winf) + H_u_tho * p.w_infstar;
    let tau_w_rl = (p.tau_wplus * tau_wminus) / (p.tau_wplus - p.tau_wplus * H_u_thw + tau_wminus * H_u_thw);
    let w_inf_rl = (p.tau_wplus * w_inf * (1.0 - H_u_thw)) / (p.tau_wplus - p.tau_wplus * H_u_thw + tau_wminus * H_u_thw);
    var w_next: f32;
    if (tau_w_rl > 1e-10) { w_next = w_inf_rl + (val_w - w_inf_rl) * exp(-params.dt / tau_w_rl); } else { w_next = val_w; }

    let s_inf_rl = (1.0 + tanh(p.k_s * (val_u - p.u_s))) * 0.5;
    var s_next: f32;
    if (tau_s > 1e-10) { s_next = s_inf_rl + (val_s - s_inf_rl) * exp(-params.dt / tau_s); } else { s_next = val_s; }

    vws_out[idx] = vec4<f32>(v_next, w_next, s_next, 0.0);
  }
`;

export async function runMinimalGPU2DSimulation(payload, onProgress) {
  const adapter = await navigator.gpu.requestAdapter();
  const requiredLimits = {
      maxStorageBuffersPerShaderStage: adapter.limits.maxStorageBuffersPerShaderStage
  };
  if (adapter.limits.maxBufferSize) requiredLimits.maxBufferSize = adapter.limits.maxBufferSize;
  if (adapter.limits.maxStorageBufferBindingSize) requiredLimits.maxStorageBufferBindingSize = adapter.limits.maxStorageBufferBindingSize;
  if (adapter.limits.maxComputeWorkgroupStorageSize) requiredLimits.maxComputeWorkgroupStorageSize = adapter.limits.maxComputeWorkgroupStorageSize;
  
  const device = await adapter.requestDevice({ requiredLimits });
  const { sigma_l, sigma_t, angle, L, N, totalTime, stimuli, fibrosisParams } = payload;
  let dt = payload.dt || 0.1;
  let downsamplingFactor = payload.downsamplingFactor || 10;
  const dx = L / N; const dy = dx;
  const size = N * N;

  const MAX_UI_N = 300;
  let spatialStride = 1;
  let N_out = N;
  if (N > MAX_UI_N) {
      spatialStride = Math.ceil(N / MAX_UI_N);
      N_out = Math.ceil(N / spatialStride);
  }
  const outSize = N_out * N_out;

  const rad = (angle * Math.PI) / 180.0;
  const c = Math.cos(rad), s = Math.sin(rad);
  const c2 = c * c, s2 = s * s, cs = c * s;

  const base_Dxx = sigma_l * c2 + sigma_t * s2;
  const base_Dyy = sigma_l * s2 + sigma_t * c2;
  const base_Dxy = (sigma_l - sigma_t) * cs;

  let max_D = Math.max(base_Dxx, base_Dyy);
  if (fibrosisParams && fibrosisParams.enabled) {
      max_D = Math.max(max_D, fibrosisParams.conductivity);
  }
  const cfl_limit = (dx * dx) / ((4 * max_D + 2 * Math.abs(base_Dxy)) || 1); 
  if (dt > cfl_limit) dt = cfl_limit * 0.9;

  const steps = Math.floor(totalTime / dt);
  const MAX_FRAMES = 1000; 
  let temporalStride = downsamplingFactor;

  if (Math.floor(steps / temporalStride) > MAX_FRAMES) {
      temporalStride = Math.ceil(steps / MAX_FRAMES);
      console.log(`Malha densa: Stride temporal elevado para ${temporalStride} iter/frame.`);
  }
  const expectedFrames = Math.floor(steps / temporalStride) + 1;

  const initialU = new Float32Array(size).fill(0.0);
  const initialVWS = new Float32Array(size * 4);
  for (let i = 0; i < size; i++) {
    initialVWS[i * 4 + 0] = 1.0;
    initialVWS[i * 4 + 1] = 1.0;
    initialVWS[i * 4 + 2] = 0.0;
  }

  let Dxx_map = new Float32Array(size).fill(base_Dxx);
  let Dyy_map = new Float32Array(size).fill(base_Dyy);
  let Dxy_map = new Float32Array(size).fill(base_Dxy);
  let fibrosisMap = new Float32Array(size).fill(sigma_l);

  // Geração da Fibrose
  if (fibrosisParams && fibrosisParams.enabled) {
    const { conductivity, type, distribution, shape, rectParams, circleParams, regionParams, borderZone = 0, seed, density } = fibrosisParams;
    const lerp = (a, b, t) => a + (b - a) * t;

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
            const y = i * dy, x = j * dx, idx = i * N + j;
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
            const y = i * dy, x = j * dx, idx = i * N + j;
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
      let numRegions, i_min = 0, i_max = N - 1, j_min = 0, j_max = N - 1;
      const pixelArea = dx * dy;

      if (type === 'diffuse' && regionParams) {
        const { x1, y1, x2, y2 } = regionParams;
        i_min = Math.max(0, Math.floor(Math.min(y1, y2) / dy)); i_max = Math.min(N - 1, Math.floor(Math.max(y1, y2) / dy));
        j_min = Math.max(0, Math.floor(Math.min(x1, x2) / dx)); j_max = Math.min(N - 1, Math.floor(Math.max(x1, x2) / dx));
        numRegions = Math.ceil(((Math.abs(x2 - x1) * Math.abs(y2 - y1)) * density) / pixelArea);
      } else {
        numRegions = Math.ceil(((L * L) * density) / pixelArea);
      }

      let generated = 0, attempts = 0;
      while (generated < numRegions && attempts < numRegions * 5) {
        attempts++;
        const idx = random.nextInt(i_min, i_max) * N + random.nextInt(j_min, j_max);
        Dxx_map[idx] = conductivity; Dyy_map[idx] = conductivity; Dxy_map[idx] = 0.0;
        fibrosisMap[idx] = conductivity;
        generated++;
      }
    }
  }

  const stimulus_maps = [];
  const stimulus_timings = [];
  let cumulativeTime = 0;

  stimuli.forEach((stim, index) => {
    let map = new Float32Array(size).fill(0);
    if (stim.shape === 'rectangle') { 
      const { x1, y1, x2, y2 } = stim.rectParams;
      const i1=Math.floor(y1/dy), j1=Math.floor(x1/dx), i2=Math.floor(y2/dy), j2=Math.floor(x2/dx);
      for (let i=Math.min(i1,i2); i<=Math.max(i1,i2); i++) 
        for (let j=Math.min(j1,j2); j<=Math.max(j1,j2); j++) 
          if (i>=0&&i<N&&j>=0&&j<N) map[i*N+j]=1;
    } else { 
      const { cx, cy, radius } = stim.circleParams; const rSq = radius*radius;
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

  const createBuffer = (arr, usage) => {
    const buf = device.createBuffer({ size: Math.max(arr.byteLength, 16), usage: usage | GPUBufferUsage.COPY_DST });
    device.queue.writeBuffer(buf, 0, arr);
    return buf;
  };

  const COMMON_MINIMAL = {
    u_o: 0.0, theta_v: 0.3, theta_w: 0.13, tau_vplus: 1.4506, tau_s1: 2.7342, k_s: 2.0994, u_s: 0.9087
  };

  const getParamArray = (p) => [
    COMMON_MINIMAL.u_o, p.u_u, COMMON_MINIMAL.theta_v, COMMON_MINIMAL.theta_w,
    p.theta_vminus, p.theta_o, p.tau_v1minus, p.tau_v2minus,
    COMMON_MINIMAL.tau_vplus, p.tau_w1minus, p.tau_w2minus, p.k_wminus,
    p.u_wminus, p.tau_wplus, p.tau_fi, p.tau_o1,
    p.tau_o2, p.tau_so1, p.tau_so2, p.k_so,
    p.u_so, COMMON_MINIMAL.tau_s1, p.tau_s2, COMMON_MINIMAL.k_s,
    COMMON_MINIMAL.u_s, p.tau_si, p.tau_winf, p.w_infstar
  ];

  const uniformData = new Float32Array(8 + 3 * 28);
  uniformData[0] = N; uniformData[1] = dx; uniformData[2] = dt; 
  uniformData[3] = payload.transmuralityParams?.enabled ? 1.0 : 0.0;
  uniformData[4] = (payload.transmuralityParams?.mid_start || 0) / 100.0; 
  uniformData[5] = (payload.transmuralityParams?.epi_start || 0) / 100.0;
  uniformData[6] = 0; uniformData[7] = 0;

  const endoP = getParamArray(payload.minimalCellParams.endo);
  const myoP = getParamArray(payload.minimalCellParams.myo);
  const epiP = getParamArray(payload.minimalCellParams.epi);
  const cellType = payload.cellType || 'epi';
  const singleP = getParamArray(payload.minimalCellParams[cellType]);

  if (payload.transmuralityParams?.enabled) {
    uniformData.set(endoP, 8);
    uniformData.set(myoP, 8 + 28);
    uniformData.set(epiP, 8 + 56);
  } else {
    uniformData.set(singleP, 8);
    uniformData.set(singleP, 8 + 28);
    uniformData.set(singleP, 8 + 56);
  }

  const bufParams = createBuffer(uniformData, GPUBufferUsage.UNIFORM);
  
  let d_map_data = new Float32Array(size * 4);
  for (let k = 0; k < size; k++) {
    d_map_data[k * 4 + 0] = Dxx_map[k];
    d_map_data[k * 4 + 1] = Dyy_map[k];
    d_map_data[k * 4 + 2] = Dxy_map[k];
  }
  const bufD_map = createBuffer(d_map_data, GPUBufferUsage.STORAGE);
  
  const currentStimulusArray = new Float32Array(size).fill(0);
  const bufStimulus = createBuffer(currentStimulusArray, GPUBufferUsage.STORAGE);

  let bufU_A = createBuffer(initialU, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC);
  let bufU_B = device.createBuffer({ size: initialU.byteLength, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST });
  let bufVWS_A = createBuffer(initialVWS, GPUBufferUsage.STORAGE);
  let bufVWS_B = device.createBuffer({ size: initialVWS.byteLength, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });

  const module = device.createShaderModule({ code: MINIMAL_SIMULATION_SHADER });
  const pipeline = device.createComputePipeline({ layout: 'auto', compute: { module, entryPoint: 'main' } });

  const makeBindGroup = (readU, writeU, readVWS, writeVWS) => device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: bufParams } }, 
      { binding: 1, resource: { buffer: readU } }, { binding: 2, resource: { buffer: writeU } },
      { binding: 3, resource: { buffer: readVWS } }, { binding: 4, resource: { buffer: writeVWS } },
      { binding: 5, resource: { buffer: bufD_map } },
      { binding: 6, resource: { buffer: bufStimulus } },
    ],
  });

  const bindGroupA = makeBindGroup(bufU_A, bufU_B, bufVWS_A, bufVWS_B);
  const bindGroupB = makeBindGroup(bufU_B, bufU_A, bufVWS_B, bufVWS_A);

  const stagingBuffers = [
    device.createBuffer({ size: initialU.byteLength, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ }),
    device.createBuffer({ size: initialU.byteLength, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ })
  ];

  const framesBuffer = new Array(expectedFrames);
  const timesBuffer = new Float32Array(expectedFrames);

  const initialU_out = new Float32Array(outSize);
  let out_fibrosisMap = new Float32Array(outSize);
  for (let i = 0; i < N_out; i++) {
      for (let j = 0; j < N_out; j++) {
          const origIdx = (i * spatialStride) * N + (j * spatialStride);
          const outIdx = i * N_out + j;
          if ((i * spatialStride) < N && (j * spatialStride) < N) {
              initialU_out[outIdx] = (initialU[origIdx] * 85.7) - 84.0;
              out_fibrosisMap[outIdx] = fibrosisMap[origIdx];
          }
      }
  }

  framesBuffer[0] = initialU_out;
  timesBuffer[0] = 0;
  let frameIndex = 1;

  const activationState = new Uint8Array(outSize).fill(0);
  const activationStartTime = new Float32Array(outSize).fill(-1);
  const activationCount = new Uint32Array(outSize).fill(0);
  const activationTimes = [new Float32Array(outSize).fill(-1)];
  const apd = [new Float32Array(outSize).fill(-1)];
  let maxActivations = 1; const threshold = 0.3;

  const workgroupCount = Math.ceil(N / 16);
  let activeStimulusIndex = -1;
  let pendingMapPromise = null;
  let currentStagingIdx = 0;

  for (let t = 0; t < steps; t += temporalStride) {
    if (payload.abortSignal && payload.abortSignal.aborted) {
        bufParams.destroy(); bufD_map.destroy(); 
        bufStimulus.destroy(); bufU_A.destroy(); bufU_B.destroy(); 
        bufVWS_A.destroy(); bufVWS_B.destroy(); 
        stagingBuffers[0].destroy(); stagingBuffers[1].destroy();
        throw new Error("Simulation aborted by user");
    }

    const currentSteps = Math.min(temporalStride, steps - t);
    let s = 0;

    while (s < currentSteps) {
      const currentTimeBase = (t + s) * dt;
      let nextEventTime = totalTime + 1;
      let nextStimulusIndex = -1;

      for (let i = 0; i < stimulus_timings.length; i++) {
        const st = stimulus_timings[i];
        if (currentTimeBase >= st.startTime && currentTimeBase < st.endTime) nextStimulusIndex = i;
        if (st.startTime > currentTimeBase && st.startTime < nextEventTime) nextEventTime = st.startTime;
        if (st.endTime > currentTimeBase && st.endTime < nextEventTime) nextEventTime = st.endTime;
      }

      if (nextStimulusIndex !== activeStimulusIndex) {
        activeStimulusIndex = nextStimulusIndex;
        if (activeStimulusIndex !== -1) {
          const timing = stimulus_timings[activeStimulusIndex];
          const map = stimulus_maps[activeStimulusIndex];
          for (let k = 0; k < size; k++) currentStimulusArray[k] = map[k] * timing.amplitude;
        } else {
          currentStimulusArray.fill(0);
        }
        device.queue.writeBuffer(bufStimulus, 0, currentStimulusArray);
      }

      const stepsUntilEvent = Math.ceil((nextEventTime - currentTimeBase) / dt);
      const stepsToRunNow = Math.max(1, Math.min(currentSteps - s, stepsUntilEvent));

      const commandEncoder = device.createCommandEncoder();
      for (let run = 0; run < stepsToRunNow; run++) {
        const pass = commandEncoder.beginComputePass();
        pass.setPipeline(pipeline);
        pass.setBindGroup(0, ((t + s + run) % 2 === 0) ? bindGroupA : bindGroupB);
        pass.dispatchWorkgroups(workgroupCount, workgroupCount);
        pass.end();
      }
      device.queue.submit([commandEncoder.finish()]);
      s += stepsToRunNow;
    }

    const commandEncoderRead = device.createCommandEncoder();
    const latestBuf = ((t + currentSteps) % 2 === 0) ? bufU_A : bufU_B;
    const stagingBuf = stagingBuffers[currentStagingIdx];
    commandEncoderRead.copyBufferToBuffer(latestBuf, 0, stagingBuf, 0, initialU.byteLength);
    device.queue.submit([commandEncoderRead.finish()]);

    const prevStagingIdx = currentStagingIdx;
    const mapPromise = stagingBuf.mapAsync(GPUMapMode.READ);
    currentStagingIdx = (currentStagingIdx + 1) % 2;

    if (pendingMapPromise) {
      await pendingMapPromise.promise;
      const readBuf = stagingBuffers[pendingMapPromise.idx];
      if (pendingMapPromise.frameIndex < expectedFrames) {
        const fullFrame = new Float32Array(readBuf.getMappedRange());
        const currentTime = pendingMapPromise.time;
        let outFrame = new Float32Array(outSize);

        if (spatialStride === 1) {
          for (let i = 0; i < outSize; i++) {
              outFrame[i] = (fullFrame[i] * 85.7) - 84.0;
          }
        } else {
          for (let i = 0; i < N_out; i++) {
            for (let j = 0; j < N_out; j++) {
              outFrame[i * N_out + j] = (fullFrame[(i * spatialStride) * N + (j * spatialStride)] * 85.7) - 84.0;
            }
          }
        }

        framesBuffer[pendingMapPromise.frameIndex] = outFrame;
        timesBuffer[pendingMapPromise.frameIndex] = currentTime;

        for (let i = 0; i < outSize; i++) {
          const volt = (outFrame[i] + 84.0) / 85.7; // convert back to 0-1.5 range for activation threshold
          if (activationState[i] === 0) {
              if (volt >= threshold) {
                  activationState[i] = 1; activationStartTime[i] = currentTime;
                  let c = activationCount[i]; activationCount[i]++;
                  if (c >= maxActivations) {
                      maxActivations++;
                      activationTimes.push(new Float32Array(outSize).fill(-1));
                      apd.push(new Float32Array(outSize).fill(-1));
                  }
                  activationTimes[c][i] = currentTime;
              }
          } else if (activationState[i] === 1) {
              if (volt < threshold) {
                  activationState[i] = 2;
                  let c = activationCount[i] - 1;
                  if (c >= 0) apd[c][i] = currentTime - activationStartTime[i];
              }
          } else if (activationState[i] === 2) {
              if (volt < 0.1) activationState[i] = 0;
          }
        }
      }
      readBuf.unmap();
    }

    pendingMapPromise = { promise: mapPromise, idx: prevStagingIdx, frameIndex: frameIndex, time: (t + currentSteps) * dt };
    frameIndex++;

    if (onProgress) onProgress(Math.round(((t + currentSteps) / steps) * 100));
  }

  if (pendingMapPromise) {
    await pendingMapPromise.promise;
    const readBuf = stagingBuffers[pendingMapPromise.idx];
    if (pendingMapPromise.frameIndex < expectedFrames) {
      const fullFrame = new Float32Array(readBuf.getMappedRange());
      const currentTime = pendingMapPromise.time;
      let outFrame = new Float32Array(outSize);
      if (spatialStride === 1) {
          for (let i = 0; i < outSize; i++) {
              outFrame[i] = (fullFrame[i] * 85.7) - 84.0;
          }
      } else {
        for (let i = 0; i < N_out; i++) {
          for (let j = 0; j < N_out; j++) {
            outFrame[i * N_out + j] = (fullFrame[(i * spatialStride) * N + (j * spatialStride)] * 85.7) - 84.0;
          }
        }
      }
      framesBuffer[pendingMapPromise.frameIndex] = outFrame;
      timesBuffer[pendingMapPromise.frameIndex] = currentTime;

      for (let i = 0; i < outSize; i++) {
        const volt = (outFrame[i] + 84.0) / 85.7;
        if (activationState[i] === 0) {
            if (volt >= threshold) {
                activationState[i] = 1; activationStartTime[i] = currentTime;
                let c = activationCount[i]; activationCount[i]++;
                if (c >= maxActivations) {
                    maxActivations++;
                    activationTimes.push(new Float32Array(outSize).fill(-1));
                    apd.push(new Float32Array(outSize).fill(-1));
                }
                activationTimes[c][i] = currentTime;
            }
        } else if (activationState[i] === 1) {
            if (volt < threshold) {
                activationState[i] = 2;
                let c = activationCount[i] - 1;
                if (c >= 0) apd[c][i] = currentTime - activationStartTime[i];
            }
        } else if (activationState[i] === 2) {
            if (volt < 0.1) activationState[i] = 0;
        }
      }
    }
    readBuf.unmap();
  }

  bufParams.destroy(); bufD_map.destroy(); 
  bufStimulus.destroy(); bufU_A.destroy(); bufU_B.destroy(); 
  bufVWS_A.destroy(); bufVWS_B.destroy(); 
  stagingBuffers[0].destroy(); stagingBuffers[1].destroy();

  return {
    frames: framesBuffer, times: timesBuffer, fibrosis: out_fibrosisMap,
    activationTimes: activationTimes, apd: apd, N: N_out, totalFrames: frameIndex
  };
}
