// Classe auxiliar para replicação exata da semente de fibrose randômica/difusa
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

// Shader WGSL completo
const SIMULATION_SHADER = `
  struct UniformParams {
    N: f32, dx: f32, dt: f32,
    tau_in: f32, tau_out: f32, tau_open: f32, tau_close: f32, v_gate: f32,
  };

  @group(0) @binding(0) var<uniform> params: UniformParams;
  @group(0) @binding(1) var<storage, read> v_in: array<f32>;
  @group(0) @binding(2) var<storage, read_write> v_out: array<f32>;
  @group(0) @binding(3) var<storage, read_write> h_state: array<f32>;
  @group(0) @binding(4) var<storage, read> dxx_map: array<f32>;
  @group(0) @binding(5) var<storage, read> dyy_map: array<f32>;
  @group(0) @binding(6) var<storage, read> dxy_map: array<f32>;
  @group(0) @binding(7) var<storage, read> stimulus_map: array<f32>;

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
      v_out[idx] = v_in[mirror_i * n + mirror_j];
      return;
    }

    let vp = v_in[idx];
    let hp = h_state[idx];
    
    let Dxx = dxx_map[idx]; let Dyy = dyy_map[idx]; let Dxy = dxy_map[idx];
    let stimulus = stimulus_map[idx];

    var alpha_h: f32 = 0.0; var beta_h: f32 = 0.0;
    if (vp < params.v_gate) { alpha_h = 1.0 / params.tau_open; } 
    else { beta_h = 1.0 / params.tau_close; }

    let sum_ab = alpha_h + beta_h;
    var h_new = hp;
    if (sum_ab > 1e-10) {
      let h_inf = alpha_h / sum_ab;
      h_new = h_inf + (hp - h_inf) * exp(-sum_ab * params.dt);
      h_state[idx] = h_new;
    }

    let inv_dx2 = 1.0 / (params.dx * params.dx);
    let inv_4dx2 = 1.0 / (4.0 * params.dx * params.dx);

    let d2v_dx2 = (v_in[idx - 1u] - 2.0 * vp + v_in[idx + 1u]) * inv_dx2;
    let d2v_dy2 = (v_in[idx - n] - 2.0 * vp + v_in[idx + n]) * inv_dx2;
    
    let v_dr = v_in[idx + n + 1u]; let v_dl = v_in[idx + n - 1u];
    let v_ur = v_in[idx - n + 1u]; let v_ul = v_in[idx - n - 1u];
    let d2v_dxdy = (v_dr - v_dl - v_ur + v_ul) * inv_4dx2;

    let lap_v = (Dxx * d2v_dx2) + (Dyy * d2v_dy2) + (2.0 * Dxy * d2v_dxdy);

    let j_in  = (h_new * vp * vp * (1.0 - vp)) / params.tau_in;
    let j_out = -vp / params.tau_out;

    var v_next = vp + params.dt * (lap_v + j_in + j_out + stimulus);

    if (v_next < 0.0) { v_next = 0.0; }
    if (v_next > 1.5) { v_next = 1.5; }

    v_out[idx] = v_next;
  }
`;

export async function runGPU2DSimulation(payload, onProgress) {
  const adapter = await navigator.gpu.requestAdapter();
  const device = await adapter.requestDevice();

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

  const steps = Math.floor(totalTime / dt);
  const MAX_FRAMES = 1000; 
  let temporalStride = downsamplingFactor;

  if (Math.floor(steps / temporalStride) > MAX_FRAMES) {
      temporalStride = Math.ceil(steps / MAX_FRAMES);
      console.log(`Malha densa: Stride temporal elevado para ${temporalStride} iter/frame.`);
  }
  const expectedFrames = Math.floor(steps / temporalStride) + 1;

  // CFL E TENSORES
  const rad = (angle * Math.PI) / 180.0;
  const c = Math.cos(rad), s = Math.sin(rad);
  const c2 = c * c, s2 = s * s, cs = c * s;

  const base_Dxx = sigma_l * c2 + sigma_t * s2;
  const base_Dyy = sigma_l * s2 + sigma_t * c2;
  const base_Dxy = (sigma_l - sigma_t) * cs;

  const max_D = Math.max(base_Dxx, base_Dyy);
  const cfl_limit = (dx * dx) / ((4 * max_D + 2 * Math.abs(base_Dxy)) || 1); 
  if (dt > cfl_limit) dt = cfl_limit * 0.9;

  // Alocação da Física
  const initialV = new Float32Array(size).fill(payload.v_init || 0.0);
  const initialH = new Float32Array(size).fill(payload.h_init || 1.0);
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

  // MAPAS DE ESTÍMULO
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

  // ALOCAÇÃO DE BUFFERS NA VRAM
  const createBuffer = (arr, usage) => {
    const buf = device.createBuffer({ size: Math.max(arr.byteLength, 16), usage: usage | GPUBufferUsage.COPY_DST });
    device.queue.writeBuffer(buf, 0, arr);
    return buf;
  };

  const uniformParams = new Float32Array([N, dx, dt, payload.Tau_in, payload.Tau_out, payload.Tau_open, payload.Tau_close, payload.gate]);
  const bufParams = createBuffer(uniformParams, GPUBufferUsage.UNIFORM);
  const bufH = createBuffer(initialH, GPUBufferUsage.STORAGE);
  const bufDxx = createBuffer(Dxx_map, GPUBufferUsage.STORAGE);
  const bufDyy = createBuffer(Dyy_map, GPUBufferUsage.STORAGE);
  const bufDxy = createBuffer(Dxy_map, GPUBufferUsage.STORAGE);
  
  // Buffer dinâmico de correntes de estímulo
  const currentStimulusArray = new Float32Array(size).fill(0);
  const bufStimulus = createBuffer(currentStimulusArray, GPUBufferUsage.STORAGE);

  let bufV_A = createBuffer(initialV, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC);
  let bufV_B = device.createBuffer({ size: initialV.byteLength, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST });

  const module = device.createShaderModule({ code: SIMULATION_SHADER });
  const pipeline = device.createComputePipeline({ layout: 'auto', compute: { module, entryPoint: 'main' } });

  const makeBindGroup = (readBuf, writeBuf) => device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: bufParams } }, { binding: 1, resource: { buffer: readBuf } }, { binding: 2, resource: { buffer: writeBuf } },
      { binding: 3, resource: { buffer: bufH } }, { binding: 4, resource: { buffer: bufDxx } }, { binding: 5, resource: { buffer: bufDyy } },
      { binding: 6, resource: { buffer: bufDxy } }, { binding: 7, resource: { buffer: bufStimulus } },
    ],
  });

  const bindGroupA = makeBindGroup(bufV_A, bufV_B);
  const bindGroupB = makeBindGroup(bufV_B, bufV_A);

  const stagingBuffer = device.createBuffer({ size: initialV.byteLength, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });

  // Saída
  const framesBuffer = new Array(expectedFrames);
  const timesBuffer = new Float32Array(expectedFrames);

  const initialV_out = new Float32Array(outSize);
  let out_fibrosisMap = new Float32Array(outSize);
  for (let i = 0; i < N_out; i++) {
      for (let j = 0; j < N_out; j++) {
          const origIdx = (i * spatialStride) * N + (j * spatialStride);
          const outIdx = i * N_out + j;
          if ((i * spatialStride) < N && (j * spatialStride) < N) {
              initialV_out[outIdx] = initialV[origIdx];
              out_fibrosisMap[outIdx] = fibrosisMap[origIdx];
          }
      }
  }

  framesBuffer[0] = initialV_out;
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

  // EXECUÇÃO ORQUESTRADA DA GPU
  for (let t = 0; t < steps; t += temporalStride) {
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

    // Cpu
    const commandEncoderRead = device.createCommandEncoder();
    const latestBuf = ((t + currentSteps) % 2 === 0) ? bufV_A : bufV_B;
    commandEncoderRead.copyBufferToBuffer(latestBuf, 0, stagingBuffer, 0, initialV.byteLength);
    device.queue.submit([commandEncoderRead.finish()]);

    await stagingBuffer.mapAsync(GPUMapMode.READ);
    if (frameIndex < expectedFrames) {
      const fullFrame = new Float32Array(stagingBuffer.getMappedRange());
      const currentTime = (t + currentSteps) * dt;
      let outFrame;

      if (spatialStride === 1) {
        outFrame = fullFrame.slice();
      } else {
        outFrame = new Float32Array(outSize);
        for (let i = 0; i < N_out; i++) {
          for (let j = 0; j < N_out; j++) {
            outFrame[i * N_out + j] = fullFrame[(i * spatialStride) * N + (j * spatialStride)];
          }
        }
      }

      framesBuffer[frameIndex] = outFrame;
      timesBuffer[frameIndex] = currentTime;
      frameIndex++;

      for (let i = 0; i < outSize; i++) {
        const volt = outFrame[i];
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
    stagingBuffer.unmap();

    if (onProgress) onProgress(Math.round(((t + currentSteps) / steps) * 100));
  }

  // Liberação da VRAM
  bufParams.destroy(); bufH.destroy(); bufDxx.destroy(); bufDyy.destroy(); bufDxy.destroy();
  bufStimulus.destroy(); bufV_A.destroy(); bufV_B.destroy(); stagingBuffer.destroy();

  return {
    frames: framesBuffer,
    times: timesBuffer,
    fibrosis: out_fibrosisMap,
    activationTimes: activationTimes,
    apd: apd,
    N: N_out, 
    totalFrames: frameIndex
  };
}

export async function checkWebGPUSupport() {
  if (!navigator.gpu) return false;
  try { return (await navigator.gpu.requestAdapter()) !== null; } 
  catch (e) { return false; }
}