export async function runGPU1DTenTusscher(payload, onProgress) {
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) throw new Error("WebGPU not supported on this adapter.");
  
  const requiredLimits = {};
  if (adapter.limits.maxBufferSize) requiredLimits.maxBufferSize = adapter.limits.maxBufferSize;
  if (adapter.limits.maxStorageBufferBindingSize) requiredLimits.maxStorageBufferBindingSize = adapter.limits.maxStorageBufferBindingSize;
  const device = await adapter.requestDevice({ requiredLimits });

  let { L, dx, dt, totalTime, cellType, inicio, duracao, amplitude, downsamplingFactor, posição_do_estímulo, tamanho_do_estímulo, num_estimulos, BCL, D } = payload;
  
  const posicao_estimulo = posição_do_estímulo || payload.posicao_estimulo || 5;
  const tamanho_estimulo = tamanho_do_estímulo || payload.tamanho_estimulo || 5;

  const N = Math.floor(L / dx);
  const steps = Math.floor(totalTime / dt);
  
  let ctype = 0;
  if (cellType === 'endo') ctype = 1;
  else if (cellType === 'myo') ctype = 2;

  // WGSL Shader (Com clamps e solução analítica)
  const shaderCode = `
    struct Params {
      N: u32,
      dx: f32,
      dt: f32,
      D: f32,
      ctype: u32,
      stim_start_idx: u32,
      stim_end_idx: u32,
      current_stim: f32
    };

    @group(0) @binding(0) var<uniform> params: Params;
    @group(0) @binding(1) var<storage, read> v_in: array<f32>;
    @group(0) @binding(2) var<storage, read_write> v_out: array<f32>;
    @group(0) @binding(3) var<storage, read_write> state: array<f32>;

    const R: f32 = 8314.472;
    const T: f32 = 310.0;
    const F: f32 = 96485.3415;
    const RTONF: f32 = 26.713761; 
    const CAPACITANCE: f32 = 0.185;

    const Ko: f32 = 5.4;
    const Cao: f32 = 2.0;
    const Nao: f32 = 140.0;
    const Vc: f32 = 0.016404;
    const Vsr: f32 = 0.001094;
    const Bufc: f32 = 0.15;
    const Kbufc: f32 = 0.001;
    const Bufsr: f32 = 10.0;
    const Kbufsr: f32 = 0.3;

    @compute @workgroup_size(256)
    fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
      let idx = global_id.x;
      if (idx >= params.N) { return; }

      if (idx == 0u || idx == params.N - 1u) {
        if (idx == 0u) { v_out[idx] = v_in[1u]; }
        if (idx == params.N - 1u) { v_out[idx] = v_in[params.N - 2u]; }
        return;
      }

      let svolt = v_in[idx];
      let base = idx * 16u;
      var sm = state[base + 0u];
      var sh = state[base + 1u];
      var sj = state[base + 2u];
      var sxr1 = state[base + 3u];
      var sxr2 = state[base + 4u];
      var sxs = state[base + 5u];
      var ss = state[base + 6u];
      var sr = state[base + 7u];
      var sd = state[base + 8u];
      var sf = state[base + 9u];
      var sfca = state[base + 10u];
      var sg = state[base + 11u];
      
      let safe_Cai = max(state[base + 12u], 1e-7);
      let safe_CaSR = max(state[base + 13u], 1e-7);
      let safe_Nai = max(state[base + 14u], 1e-7);
      let safe_Ki = max(state[base + 15u], 1e-7);

      var GNa: f32 = 14.838;
      var GK1: f32 = 5.405;
      var GKr: f32 = 0.096;
      var Gks: f32 = 0.245; 
      var Gto: f32 = 0.294; 
      
      if (params.ctype == 1u) {
          Gks = 0.245; Gto = 0.073;
      } else if (params.ctype == 2u) {
          Gks = 0.062; Gto = 0.294;
      }

      let pKNa: f32 = 0.03;
      let GbNa: f32 = 0.00029;
      let KmK: f32 = 1.0;
      let KmNa: f32 = 40.0;
      let knak: f32 = 1.362;
      let GCaL: f32 = 0.000175;
      let GbCa: f32 = 0.000592;
      let knaca: f32 = 1000.0;
      let KmNai: f32 = 87.5;
      let KmCa: f32 = 1.38;
      let ksat: f32 = 0.1;
      let n_ca: f32 = 0.35;
      let GpCa: f32 = 0.825;
      let KpCa: f32 = 0.0005;
      let GpK: f32 = 0.0146;

      let Ek = RTONF * log(Ko / safe_Ki);
      let Ena = RTONF * log(Nao / safe_Nai);
      let Eks = RTONF * log((Ko + pKNa * Nao) / (safe_Ki + pKNa * safe_Nai));
      let Eca = 0.5 * RTONF * log(Cao / safe_Cai);

      let Ak1 = 0.1 / (1.0 + exp(0.06 * (svolt - Ek - 200.0)));
      let Bk1 = (3.0 * exp(0.0002 * (svolt - Ek + 100.0)) + exp(0.1 * (svolt - Ek - 10.0))) / (1.0 + exp(-0.5 * (svolt - Ek)));
      let rec_iK1 = Ak1 / (Ak1 + Bk1);
      let rec_iNaK = 1.0 / (1.0 + 0.1245 * exp(-0.1 * svolt * F / (R * T)) + 0.0353 * exp(-svolt * F / (R * T)));
      let rec_ipK = 1.0 / (1.0 + exp((25.0 - svolt) / 5.98));

      let INa = GNa * sm * sm * sm * sh * sj * (svolt - Ena);
      let vffrt = 2.0 * svolt * F / (R * T);
      let vffrt_exp = exp(vffrt);
      var denom = vffrt_exp - 1.0;
      if (abs(denom) < 1e-6) { denom = 1e-6; }
      
      let ICaL = GCaL * sd * sf * sfca * 4.0 * svolt * (F * F / (R * T)) *
                 (vffrt_exp * safe_Cai - 0.341 * Cao) / denom;
      let Ito = Gto * sr * ss * (svolt - Ek);
      let IKr = GKr * sqrt(Ko / 5.4) * sxr1 * sxr2 * (svolt - Ek);
      let IKs = Gks * sxs * sxs * (svolt - Eks);
      let IK1 = GK1 * rec_iK1 * (svolt - Ek);
      
      let INaCa = knaca * (1.0 / (KmNai * KmNai * KmNai + Nao * Nao * Nao)) * (1.0 / (KmCa + Cao)) *
                  (1.0 / (1.0 + ksat * exp((n_ca - 1.0) * svolt * F / (R * T)))) *
                  (exp(n_ca * svolt * F / (R * T)) * safe_Nai * safe_Nai * safe_Nai * Cao -
                   exp((n_ca - 1.0) * svolt * F / (R * T)) * Nao * Nao * Nao * safe_Cai * 2.5);
                   
      let INaK = knak * (Ko / (Ko + KmK)) * (safe_Nai / (safe_Nai + KmNa)) * rec_iNaK;
      let IpCa = GpCa * safe_Cai / (KpCa + safe_Cai);
      let IpK = GpK * rec_ipK * (svolt - Ek);
      let IbNa = GbNa * (svolt - Ena);
      let IbCa = GbCa * (svolt - Eca);

      let I_ion = IKr + IKs + IK1 + Ito + INa + IbNa + ICaL + IbCa + INaK + INaCa + IpCa + IpK;

      let dt = params.dt;

      // Dynamics Ca
      let Caisquare = safe_Cai * safe_Cai;
      let CaSRsquare = safe_CaSR * safe_CaSR;
      let CaCurrent = -(ICaL + IbCa + IpCa - 2.0 * INaCa) * 1.0 / (2.0 * Vc * F) * CAPACITANCE;
      
      let A_rel = 0.016464 * CaSRsquare / (0.0625 + CaSRsquare) + 0.008232;
      let Irel = A_rel * sd * sg;
      
      let Vmax_up = 0.000425; let Kup = 0.00025;
      let Iup = Vmax_up / (1.0 + (Kup * Kup) / Caisquare);
      let I_leak = 0.00008 * (safe_CaSR - safe_Cai);

      let CaSRCurrent = Iup - Irel - I_leak;
      let CaCSQN = Bufsr * safe_CaSR / (safe_CaSR + Kbufsr);
      let dCaSR = dt * (Vc / Vsr) * CaSRCurrent;
      let bjsr = Bufsr - CaCSQN - dCaSR - safe_CaSR + Kbufsr;
      let cjsr = Kbufsr * (CaCSQN + dCaSR + safe_CaSR);
      var next_CaSR = (sqrt(max(bjsr * bjsr + 4.0 * cjsr, 0.0)) - bjsr) / 2.0;

      let CaBuf = Bufc * safe_Cai / (safe_Cai + Kbufc);
      let dCai = dt * (CaCurrent - CaSRCurrent);
      let bc = Bufc - CaBuf - dCai - safe_Cai + Kbufc;
      let cc = Kbufc * (CaBuf + dCai + safe_Cai);
      var next_Cai = (sqrt(max(bc * bc + 4.0 * cc, 0.0)) - bc) / 2.0;

      let dNai = -(INa + IbNa + 3.0 * INaK + 3.0 * INaCa) * 1.0 / (Vc * F) * CAPACITANCE;
      var next_Nai = safe_Nai + dt * dNai;
      let dKi = -(Ito + IKr + IKs + IK1 + IpK - 2.0 * INaK) * 1.0 / (Vc * F) * CAPACITANCE;
      var next_Ki = safe_Ki + dt * dKi;

      // Gates 
      var m_inf: f32 = 1.0 / ((1.0 + exp((-56.86 - svolt) / 9.03)) * (1.0 + exp((-56.86 - svolt) / 9.03)));
      var a_m: f32 = 1.0 / (1.0 + exp((-60.0 - svolt) / 5.0));
      var b_m: f32 = 0.1 / (1.0 + exp((svolt + 35.0) / 5.0)) + 0.1 / (1.0 + exp((svolt - 50.0) / 200.0));
      var tau_m: f32 = a_m * b_m;
      sm = m_inf - (m_inf - sm) * exp(-dt / max(tau_m, 1e-4));
      
      var h_inf: f32 = 1.0 / ((1.0 + exp((svolt + 71.55) / 7.43)) * (1.0 + exp((svolt + 71.55) / 7.43)));
      var a_h: f32 = 0.0; var b_h: f32 = 0.0;
      if (svolt < -40.0) {
        a_h = 0.057 * exp(-(svolt + 80.0) / 6.8);
        b_h = 2.7 * exp(0.079 * svolt) + 3.1e5 * exp(0.3485 * svolt);
      } else {
        b_h = 0.77 / (0.13 * (1.0 + exp(-(svolt + 10.66) / 11.1)));
      }
      var tau_h: f32 = 1.0 / (a_h + b_h);
      sh = h_inf - (h_inf - sh) * exp(-dt / max(tau_h, 1e-4));
      
      var j_inf: f32 = 1.0 / ((1.0 + exp((svolt + 71.55) / 7.43)) * (1.0 + exp((svolt + 71.55) / 7.43)));
      var a_j: f32 = 0.0; var b_j: f32 = 0.0;
      if (svolt < -40.0) {
        a_j = (-25428.0 * exp(0.2444 * svolt) - 6.948e-6 * exp(-0.04391 * svolt)) * (svolt + 37.78) / (1.0 + exp(0.311 * (svolt + 79.23)));
        b_j = 0.02424 * exp(-0.01052 * svolt) / (1.0 + exp(-0.1378 * (svolt + 40.14)));
      } else {
        b_j = 0.6 * exp(0.057 * svolt) / (1.0 + exp(-0.1 * (svolt + 32.0)));
      }
      var tau_j: f32 = 1.0 / (a_j + b_j);
      sj = j_inf - (j_inf - sj) * exp(-dt / max(tau_j, 1e-4));
      
      var xr1_inf: f32 = 1.0 / (1.0 + exp((-26.0 - svolt) / 7.0));
      var a_xr1: f32 = 450.0 / (1.0 + exp((-45.0 - svolt) / 10.0));
      var b_xr1: f32 = 6.0 / (1.0 + exp((svolt + 30.0) / 11.5));
      var tau_xr1: f32 = a_xr1 * b_xr1;
      sxr1 = xr1_inf - (xr1_inf - sxr1) * exp(-dt / max(tau_xr1, 1e-4));
      
      var xr2_inf: f32 = 1.0 / (1.0 + exp((svolt + 88.0) / 24.0));
      var a_xr2: f32 = 3.0 / (1.0 + exp((-60.0 - svolt) / 20.0));
      var b_xr2: f32 = 1.12 / (1.0 + exp((svolt - 60.0) / 20.0));
      var tau_xr2: f32 = a_xr2 * b_xr2;
      sxr2 = xr2_inf - (xr2_inf - sxr2) * exp(-dt / max(tau_xr2, 1e-4));
      
      var xs_inf: f32 = 1.0 / (1.0 + exp((-5.0 - svolt) / 14.0));
      var a_xs: f32 = 1100.0 / sqrt(1.0 + exp((-10.0 - svolt) / 6.0));
      var b_xs: f32 = 1.0 / (1.0 + exp((svolt - 60.0) / 20.0));
      var tau_xs: f32 = a_xs * b_xs;
      sxs = xs_inf - (xs_inf - sxs) * exp(-dt / max(tau_xs, 1e-4));
      
      var s_inf: f32 = 1.0 / (1.0 + exp((svolt + 20.0) / 5.0));
      var tau_s: f32 = 85.0 * exp(-(svolt + 45.0) * (svolt + 45.0) / 320.0) + 5.0 / (1.0 + exp((svolt - 20.0) / 5.0)) + 3.0;
      if (params.ctype == 1u) {
          s_inf = 1.0 / (1.0 + exp((svolt + 28.0) / 5.0));
          tau_s = 1000.0 * exp(-(svolt + 67.0) * (svolt + 67.0) / 1000.0) + 8.0;
      }
      ss = s_inf - (s_inf - ss) * exp(-dt / max(tau_s, 1e-4));
      
      var r_inf: f32 = 1.0 / (1.0 + exp((20.0 - svolt) / 6.0));
      var tau_r: f32 = 9.5 * exp(-(svolt + 40.0) * (svolt + 40.0) / 1800.0) + 0.8;
      sr = r_inf - (r_inf - sr) * exp(-dt / max(tau_r, 1e-4));
      
      var d_inf: f32 = 1.0 / (1.0 + exp((-5.0 - svolt) / 7.5));
      var a_d: f32 = 1.4 / (1.0 + exp((-35.0 - svolt) / 13.0)) + 0.25;
      var b_d: f32 = 1.4 / (1.0 + exp((svolt + 5.0) / 5.0));
      var c_d: f32 = 1.0 / (1.0 + exp((50.0 - svolt) / 20.0));
      var tau_d: f32 = a_d * b_d + c_d;
      sd = d_inf - (d_inf - sd) * exp(-dt / max(tau_d, 1e-4));
      
      var f_inf: f32 = 1.0 / (1.0 + exp((svolt + 20.0) / 7.0));
      var tau_f: f32 = 1125.0 * exp(-(svolt + 27.0) * (svolt + 27.0) / 300.0) + 80.0 + 165.0 / (1.0 + exp((25.0 - svolt) / 10.0));
      sf = f_inf - (f_inf - sf) * exp(-dt / max(tau_f, 1e-4));
      
      var fca_inf: f32 = (1.0 / (1.0 + pow(safe_Cai / 0.000325, 8.0)) +
                     0.1 / (1.0 + exp((safe_Cai - 0.0005) / 0.0001)) +
                     0.20 / (1.0 + exp((safe_Cai - 0.00075) / 0.0008)) +
                     0.23) / 1.46;
      let sfca_old = sfca;
      sfca = fca_inf - (fca_inf - sfca_old) * exp(-dt / 2.0);
      if (sfca > sfca_old && svolt > -37.0) { sfca = sfca_old; }
      
      var g_inf: f32 = 0.0;
      if (safe_Cai < 0.00035) {
        g_inf = 1.0 / (1.0 + pow(safe_Cai / 0.00035, 6.0));
      } else {
        g_inf = 1.0 / (1.0 + pow(safe_Cai / 0.00035, 16.0));
      }
      let sg_old = sg;
      sg = g_inf - (g_inf - sg_old) * exp(-dt / 2.0);
      if (sg > sg_old && svolt > -37.0) { sg = sg_old; }

      // Save states
      state[base + 0u] = sm; state[base + 1u] = sh; state[base + 2u] = sj;
      state[base + 3u] = sxr1; state[base + 4u] = sxr2; state[base + 5u] = sxs;
      state[base + 6u] = ss; state[base + 7u] = sr; state[base + 8u] = sd;
      state[base + 9u] = sf; state[base + 10u] = sfca; state[base + 11u] = sg;
      state[base + 12u] = next_Cai; state[base + 13u] = next_CaSR; 
      state[base + 14u] = next_Nai; state[base + 15u] = next_Ki;

      var v_left = svolt;
      if (idx > 0u) { v_left = v_in[idx - 1u]; }
      
      var v_right = svolt;
      if (idx < params.N - 1u) { v_right = v_in[idx + 1u]; }

      let inv_dx2 = 1.0 / (params.dx * params.dx);
      let lap_v = (v_left - 2.0 * svolt + v_right) * inv_dx2;
      
      var stim: f32 = 0.0;
      if (idx >= params.stim_start_idx && idx <= params.stim_end_idx) {
        stim = params.current_stim;
      }

      var v_next = svolt + dt * (params.D * lap_v - I_ion + stim);
      
      // Anti-NaN clamps
      if (v_next < -120.0) { v_next = -120.0; }
      if (v_next > 80.0) { v_next = 80.0; }
      
      v_out[idx] = v_next;
    }
  `;

  const module = device.createShaderModule({ code: shaderCode });

  const paramsBufferSize = 32; 
  const paramsBuffer = device.createBuffer({
    size: paramsBufferSize,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const vBufferIn = device.createBuffer({
    size: N * 4,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
  });

  const vBufferOut = device.createBuffer({
    size: N * 4,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
  });

  const stateBuffer = device.createBuffer({
    size: N * 16 * 4,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });

  const readBuffer = device.createBuffer({
    size: N * 4,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
  });

  const initV = new Float32Array(N).fill(-86.2);
  device.queue.writeBuffer(vBufferIn, 0, initV);
  
  const initState = new Float32Array(N * 16);
  for (let i = 0; i < N; i++) {
    const base = i * 16;
    initState[base + 0] = 0.0; initState[base + 1] = 0.75; initState[base + 2] = 0.75; 
    initState[base + 3] = 0.0; initState[base + 4] = 1.0; initState[base + 5] = 0.0; 
    initState[base + 6] = 1.0; initState[base + 7] = 0.0; initState[base + 8] = 0.0; 
    initState[base + 9] = 1.0; initState[base + 10] = 1.0; initState[base + 11] = 1.0; 
    initState[base + 12] = 0.0002; initState[base + 13] = 0.2; 
    initState[base + 14] = 11.6; initState[base + 15] = 138.3; 
  }
  device.queue.writeBuffer(stateBuffer, 0, initState);

  const pipeline = device.createComputePipeline({
    layout: 'auto',
    compute: { module, entryPoint: 'main' },
  });

  const bindGroupIn = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: paramsBuffer } },
      { binding: 1, resource: { buffer: vBufferIn } },
      { binding: 2, resource: { buffer: vBufferOut } },
      { binding: 3, resource: { buffer: stateBuffer } },
    ],
  });

  const bindGroupOut = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: paramsBuffer } },
      { binding: 1, resource: { buffer: vBufferOut } }, 
      { binding: 2, resource: { buffer: vBufferIn } },
      { binding: 3, resource: { buffer: stateBuffer } },
    ],
  });

  const workgroupCount = Math.ceil(N / 256);
  const outputData = [];

  const stim_center_idx = Math.floor(posicao_estimulo / dx);
  const stim_half_idx = Math.floor(tamanho_estimulo / (2 * dx));
  const stim_start_idx = Math.max(1, stim_center_idx - stim_half_idx);
  const stim_end_idx = Math.min(N - 2, stim_center_idx + stim_half_idx);

  let flip = false;

  const paramData = new ArrayBuffer(32);
  const paramFloatView = new Float32Array(paramData);
  const paramUintView = new Uint32Array(paramData);

  for (let t = 0; t < steps; t++) {
    const time = t * dt;

    let current_stim = 0.0;
    for (let s = 0; s < num_estimulos; s++) {
      let t_stim = inicio + s * BCL;
      if (time >= t_stim && time < t_stim + duracao) {
        current_stim = amplitude;
        break;
      }
    }

    paramUintView[0] = N;
    paramFloatView[1] = dx;
    paramFloatView[2] = dt;
    paramFloatView[3] = D;
    paramUintView[4] = ctype;
    paramUintView[5] = stim_start_idx;
    paramUintView[6] = stim_end_idx;
    paramFloatView[7] = current_stim;
    
    device.queue.writeBuffer(paramsBuffer, 0, paramData);

    const commandEncoder = device.createCommandEncoder();
    const passEncoder = commandEncoder.beginComputePass();
    passEncoder.setPipeline(pipeline);
    passEncoder.setBindGroup(0, flip ? bindGroupOut : bindGroupIn);
    passEncoder.dispatchWorkgroups(workgroupCount);
    passEncoder.end();
    
    device.queue.submit([commandEncoder.finish()]);
    flip = !flip;

    if (t % downsamplingFactor === 0) {
      const copyEncoder = device.createCommandEncoder();
      copyEncoder.copyBufferToBuffer(flip ? vBufferIn : vBufferOut, 0, readBuffer, 0, N * 4);
      device.queue.submit([copyEncoder.finish()]);

      await readBuffer.mapAsync(GPUMapMode.READ);
      const copyArray = new Float32Array(readBuffer.getMappedRange());
      const snapshot = new Float32Array(N);
      snapshot.set(copyArray);
      readBuffer.unmap();

      const mappedSnapshot = Array.from(snapshot).map((val, i) => ({
        x: i * dx,
        v: val,
        tempo: time.toFixed(2)
      }));

      outputData.push({
        time: time.toFixed(2),
        data: mappedSnapshot
      });
    }
  }

  paramsBuffer.destroy();
  vBufferIn.destroy();
  vBufferOut.destroy();
  stateBuffer.destroy();
  readBuffer.destroy();

  return outputData;
}