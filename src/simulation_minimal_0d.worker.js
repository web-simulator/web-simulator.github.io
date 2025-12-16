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

self.onmessage = (e) => {
  const params = e.data;
  const {
    protocol,
    dt,
    cellType,
    minimalCellParams,
    downsamplingFactor,
    // Parametros gerais de estimulo
    inicio,
    duração,
    amplitude,
    // Parametros específicos
    tempo_total,
    BCL, num_estimulos, 
    BCL_S1, intervalo_S2, num_estimulos_s1
  } = params;

  // parâmetros do modelo
  let modelParams;
  if (minimalCellParams && minimalCellParams[cellType]) {
    modelParams = minimalCellParams[cellType];
  } else {
    modelParams = CELL_PARAMS[cellType] || CELL_PARAMS['epi'];
  }

  const {
    u_o, u_u, theta_v, theta_w, theta_vminus, theta_o,
    tau_v1minus, tau_v2minus, tau_vplus,
    tau_w1minus, tau_w2minus, k_wminus, u_wminus, tau_wplus,
    tau_fi, tau_o1, tau_o2, tau_so1, tau_so2, k_so, u_so,
    tau_s1, tau_s2, k_s, u_s, tau_si, tau_winf, w_infstar
  } = modelParams;

  // Definição do tempo total da simulação baseado no protocolo
  let simulationDuration = 0;
  if (protocol === 'single') {
    simulationDuration = tempo_total;
  } else if (protocol === 'multiple') {
    simulationDuration = inicio + num_estimulos * BCL + 200;
  } else if (protocol === 's1s2') {
    simulationDuration = inicio + (num_estimulos_s1 - 1) * BCL_S1 + intervalo_S2 + 2 * BCL_S1;
  }

  const passos = parseInt(simulationDuration / dt, 10);
  
  // Buffers de saída
  const sampledData = [];
  
  // Variáveis
  let u = 0.0;
  let v = 1.0;
  let w = 1.0;
  let s = 0.0;

  let tempo_atual = 0;

  for (let i = 0; i < passos; i++) {
    tempo_atual = i * dt;

    // Lógica de Estímulo
    let stim = 0;

    if (protocol === 'single') {
        if (tempo_atual >= inicio && tempo_atual < inicio + duração) {
            stim = amplitude;
        }
    } else if (protocol === 'multiple') {
        for (let k = 0; k < num_estimulos; k++) {
            const startPulse = inicio + k * BCL;
            if (tempo_atual >= startPulse && tempo_atual < startPulse + duração) {
                stim = amplitude;
                break;
            }
        }
    } else if (protocol === 's1s2') {
        // S1
        for (let k = 0; k < num_estimulos_s1; k++) {
            const startS1 = inicio + k * BCL_S1;
            if (tempo_atual >= startS1 && tempo_atual < startS1 + duração) {
                stim = amplitude;
                break;
            }
        }
        // S2
        const startS2 = inicio + (num_estimulos_s1 - 1) * BCL_S1 + intervalo_S2;
        if (tempo_atual >= startS2 && tempo_atual < startS2 + duração) {
            stim = amplitude;
        }
    }
    
    // Funções auxiliares Heaviside
    const H_u_thv = (u - theta_v) > 0 ? 1.0 : 0.0;
    const H_u_thw = (u - theta_w) > 0 ? 1.0 : 0.0;
    const H_u_thv_minus = (u - theta_vminus) > 0 ? 1.0 : 0.0;
    const H_u_tho = (u - theta_o) > 0 ? 1.0 : 0.0;

    // Constantes de tempo dependentes de voltagem
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
    u = u + du_dt * dt;

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
    v = v_target + (v - v_target) * Math.exp(-dt / v_tau);

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
    w = w_target + (w - w_target) * Math.exp(-dt / w_tau);

    // Rush-Larsen para s
    const s_inf = (1.0 + Math.tanh(k_s * (u - u_s))) * 0.5;
    s = s_inf + (s - s_inf) * Math.exp(-dt / tau_s);

    // Downsampling
    if (i % downsamplingFactor === 0) {
        sampledData.push({
            tempo: tempo_atual.toFixed(2),
            v: u,
            gate_v: v,
            gate_w: w,
            gate_s: s
        });
    }
  }

  self.postMessage(sampledData);
};