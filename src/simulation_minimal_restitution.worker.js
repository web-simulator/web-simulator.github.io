// Função para calcular APD
function calculateAPD90(v, dt, u_rest, u_amp) {
  if (!v || v.length === 0) return 0;

  const v_max = Math.max(...v);
  const amplitude = v_max - u_rest;

  // Considera AP inválido se a amplitude for muito baixa
  if (amplitude < 0.2) return 0;

  const v_repol_90 = v_max - amplitude * 0.9;

  let despolarizacaoIdx = -1;
  let repolarizacaoIdx = -1;

  // Encontra pico
  for (let i = 0; i < v.length; i++) {
    if (v[i] >= v_max * 0.98) {
      despolarizacaoIdx = i;
      break;
    }
  }

  if (despolarizacaoIdx === -1) return 0;

  // Encontra repolarização
  for (let i = despolarizacaoIdx; i < v.length; i++) {
    if (v[i] <= v_repol_90) {
      repolarizacaoIdx = i;
      break;
    }
  }

  if (repolarizacaoIdx === -1) return 0;

  return (repolarizacaoIdx - despolarizacaoIdx) * dt;
}

// Parâmetros padrão para os tipos de célula
const CELL_PARAMS = {
  endo: {
    u_o: 0.0, u_u: 1.56, theta_v: 0.3, theta_w: 0.13, theta_vminus: 0.2, theta_o: 0.006,
    tau_v1minus: 75.0, tau_v2minus: 10.0, tau_vplus: 1.4506,
    tau_w1minus: 6.0, tau_w2minus: 140.0, k_wminus: 200.0, u_wminus: 0.016, tau_wplus: 280.0,
    tau_fi: 0.15, tau_o1: 470.0, tau_o2: 6.0, tau_so1: 40.0, tau_so2: 1.2,
    k_so: 2.0, u_so: 0.65, tau_s1: 2.7342, tau_s2: 2.0, k_s: 2.0994, u_s: 0.9087, tau_si: 2.9013,
    tau_winf: 0.0273, w_infstar: 0.78
  },
  myo: {
    u_o: 0.0, u_u: 1.61, theta_v: 0.3, theta_w: 0.13, theta_vminus: 0.1, theta_o: 0.005,
    tau_v1minus: 80.0, tau_v2minus: 1.4506, tau_vplus: 1.4506,
    tau_w1minus: 70.0, tau_w2minus: 8.0, k_wminus: 200.0, u_wminus: 0.016, tau_wplus: 280.0,
    tau_fi: 0.117, tau_o1: 410.0, tau_o2: 7.0, tau_so1: 91.0, tau_so2: 0.8,
    k_so: 2.1, u_so: 0.6, tau_s1: 2.7342, tau_s2: 4.0, k_s: 2.0994, u_s: 0.9087, tau_si: 3.3849,
    tau_winf: 0.01, w_infstar: 0.5
  },
  epi: {
    u_o: 0.0, u_u: 1.55, theta_v: 0.3, theta_w: 0.13, theta_vminus: 0.006, theta_o: 0.006,
    tau_v1minus: 60.0, tau_v2minus: 1150.0, tau_vplus: 1.4506,
    tau_w1minus: 60.0, tau_w2minus: 15.0, k_wminus: 65.0, u_wminus: 0.03, tau_wplus: 200.0,
    tau_fi: 0.165, tau_o1: 400.0, tau_o2: 6.0, tau_so1: 30.0181, tau_so2: 0.9957,
    k_so: 2.0458, u_so: 0.65, tau_s1: 2.7342, tau_s2: 16.0, k_s: 2.0994, u_s: 0.9087, tau_si: 1.8875,
    tau_winf: 0.07, w_infstar: 0.94
  }
};

// Executa um ciclo S1-S2
function runSingleCycle(simParams, modelParams) {
  const {
    dt, inicio, duracao, amplitude, BCL_S1, intervalo_S2, num_estimulos_s1
  } = simParams;

  const {
    u_o, u_u, theta_v, theta_w, theta_vminus, theta_o,
    tau_v1minus, tau_v2minus, tau_vplus,
    tau_w1minus, tau_w2minus, k_wminus, u_wminus, tau_wplus,
    tau_fi, tau_o1, tau_o2, tau_so1, tau_so2, k_so, u_so,
    tau_s1, tau_s2, k_s, u_s, tau_si, tau_winf, w_infstar
  } = modelParams;

  // Tempo total: S1s + S2 + margem
  const tempo_total = inicio + (num_estimulos_s1 - 1) * BCL_S1 + intervalo_S2 + 1.5 * BCL_S1;
  const passos = parseInt(tempo_total / dt, 10);

  // Inicialização
  const u_arr = new Float32Array(passos);
  const v_arr = new Float32Array(passos);
  const w_arr = new Float32Array(passos);
  const s_arr = new Float32Array(passos);
  const tempo = new Float32Array(passos);

  // Condições iniciais
  let u = 0.0;
  let v = 1.0;
  let w = 1.0;
  let s = 0.0;

  u_arr[0] = u; v_arr[0] = v; w_arr[0] = w; s_arr[0] = s;
  tempo[0] = 0;

  for (let i = 1; i < passos; i++) {
    const t = i * dt;
    tempo[i] = t;

    // Estímulo
    let stim = 0;
    // S1
    for (let j = 0; j < num_estimulos_s1; j++) {
      const startS1 = inicio + j * BCL_S1;
      if (t >= startS1 && t < startS1 + duracao) {
        stim = amplitude;
        break;
      }
    }
    // S2
    const startS2 = inicio + (num_estimulos_s1 - 1) * BCL_S1 + intervalo_S2;
    if (t >= startS2 && t < startS2 + duracao) {
      stim = amplitude;
    }

    // Auxiliares
    const H_u_thv = (u - theta_v) > 0 ? 1.0 : 0.0;
    const H_u_thw = (u - theta_w) > 0 ? 1.0 : 0.0;
    const H_u_thv_minus = (u - theta_vminus) > 0 ? 1.0 : 0.0;
    const H_u_tho = (u - theta_o) > 0 ? 1.0 : 0.0;

    // Constantes de tempo
    const tau_vminus = (1.0 - H_u_thv_minus) * tau_v1minus + H_u_thv_minus * tau_v2minus;
    const tau_wminus = tau_w1minus + (tau_w2minus - tau_w1minus) * (1.0 + Math.tanh(k_wminus * (u - u_wminus))) * 0.5;
    const tau_so = tau_so1 + (tau_so2 - tau_so1) * (1.0 + Math.tanh(k_so * (u - u_so))) * 0.5;
    const tau_s = (1.0 - H_u_thw) * tau_s1 + H_u_thw * tau_s2;
    const tau_o = (1.0 - H_u_tho) * tau_o1 + H_u_tho * tau_o2;

    // Correntes
    const J_fi = -v * H_u_thv * (u - theta_v) * (u_u - u) / tau_fi;
    const J_so = (u - u_o) * (1.0 - H_u_thw) / tau_o + H_u_thw / tau_so;
    const J_si = -H_u_thw * w * s / tau_si;

    // Euler para u
    const du_dt = -(J_fi + J_so + J_si) + stim;
    const u_new = u + du_dt * dt;

    // Rush-Larsen para v
    const v_inf = (u < theta_vminus) ? 1.0 : 0.0;
    
    let v_tau, v_target;
    if (u >= theta_v) {
        v_tau = tau_vplus;
        v_target = 0.0;
    } else {
        v_tau = tau_vminus;
        v_target = v_inf;
    }
    const v_new = v_target + (v - v_target) * Math.exp(-dt / v_tau);

    // Rush-Larsen para w
    const w_inf = (1.0 - H_u_tho) * (1.0 - u / tau_winf) + H_u_tho * w_infstar;
    let w_tau, w_target;
    if (u >= theta_w) {
        w_tau = tau_wplus;
        w_target = 0.0;
    } else {
        w_tau = tau_wminus;
        w_target = w_inf;
    }
    const w_new = w_target + (w - w_target) * Math.exp(-dt / w_tau);

    // Rush-Larsen para s
    const s_inf = (1.0 + Math.tanh(k_s * (u - u_s))) * 0.5;
    const s_new = s_inf + (s - s_inf) * Math.exp(-dt / tau_s);

    // Atualiza
    u = u_new;
    v = v_new;
    w = w_new;
    s = s_new;

    u_arr[i] = u;
    v_arr[i] = v;
    w_arr[i] = w;
    s_arr[i] = s;
  }

  // Pega o ultimo S1 e o S2
  const inicio_ultimo_s1_idx = Math.round((inicio + (num_estimulos_s1 - 1) * BCL_S1) / dt);
  const slice_duration_idx = Math.round(1.5 * BCL_S1 / dt);
  const u_s1 = u_arr.slice(inicio_ultimo_s1_idx, inicio_ultimo_s1_idx + slice_duration_idx);

  const inicio_s2_idx = Math.round((inicio + (num_estimulos_s1 - 1) * BCL_S1 + intervalo_S2) / dt);
  const u_s2 = u_arr.slice(inicio_s2_idx, inicio_s2_idx + slice_duration_idx);

  return { u_s1, u_s2, full_u: u_arr, full_v: v_arr, full_w: w_arr, full_s: s_arr, full_tempo: tempo };
}

self.onmessage = (e) => {
  const params = e.data;
  const {
    BCL_S2_inicial, BCL_S2_final, delta_CL, downsamplingFactor, cellType = 'epi', dt, minimalCellParams
  } = params;

  let modelParams;
  if (minimalCellParams && minimalCellParams[cellType]) {
    modelParams = minimalCellParams[cellType];
  } else {
    modelParams = CELL_PARAMS[cellType] || CELL_PARAMS['epi'];
  }

  const num_ciclos = Math.floor((BCL_S2_inicial - BCL_S2_final) / delta_CL) + 1;
  const restitutionData = [];
  const allTimeSeriesData = [];
  let tempo_offset = 0;

  for (let ciclo = 0; ciclo < num_ciclos; ciclo++) {
    const intervalo_S2 = BCL_S2_inicial - (ciclo * delta_CL);
    if (intervalo_S2 < BCL_S2_final) continue;

    const cycleSimParams = { ...params, intervalo_S2 };
    const { u_s1, u_s2, full_u, full_v, full_w, full_s, full_tempo } = runSingleCycle(cycleSimParams, modelParams);

    // Calcular APD
    const apd_s1 = calculateAPD90(u_s1, dt, 0.0);
    const apd_s2 = calculateAPD90(u_s2, dt, 0.0);

    if (apd_s1 > 0 && apd_s2 > 0) {
      const di = intervalo_S2 - apd_s1;
      if (di > 0) {
        restitutionData.push({ bcl: di, apd: apd_s2 });
      }
    }

    // Downsampling
    for (let i = 0; i < full_u.length; i += downsamplingFactor) {
      if (full_tempo[i] !== undefined) {
        allTimeSeriesData.push({
          tempo: (tempo_offset + full_tempo[i]).toFixed(2),
          v: full_u[i],
          gate_v: full_v[i],
          gate_w: full_w[i],
          gate_s: full_s[i]
        });
      }
    }
    if (full_tempo.length > 0) {
      tempo_offset += full_tempo[full_tempo.length - 1];
    }
  }

  restitutionData.sort((a, b) => a.bcl - b.bcl);
  self.postMessage({ timeSeriesData: allTimeSeriesData, restitutionData });
};