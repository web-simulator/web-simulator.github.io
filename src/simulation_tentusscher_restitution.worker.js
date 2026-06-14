// Função para calcular APD
function calculateAPD90(v, dt, u_rest) {
  if (!v || v.length === 0) return 0;

  let v_max = -1000;
  for(let i=0; i<v.length; i++) {
    if(v[i] > v_max) v_max = v[i];
  }
  
  const amplitude = v_max - u_rest;
  if (amplitude < 30.0) return 0; // AP inválido se a amplitude for baixa

  const v_repol_90 = v_max - amplitude * 0.9;

  let despolarizacaoIdx = -1;
  let repolarizacaoIdx = -1;

  for (let i = 0; i < v.length; i++) {
    if (v[i] >= v_max * 0.98) {
      despolarizacaoIdx = i;
      break;
    }
  }

  if (despolarizacaoIdx === -1) return 0;

  for (let i = despolarizacaoIdx; i < v.length; i++) {
    if (v[i] <= v_repol_90) {
      repolarizacaoIdx = i;
      break;
    }
  }

  if (repolarizacaoIdx === -1) return 0;

  return (repolarizacaoIdx - despolarizacaoIdx) * dt;
}

function calculateDvDtMax(v, dt) {
  if (!v || v.length < 2) return 0;
  let maxDvDt = 0;
  for (let i = 1; i < v.length; i++) {
    const dvdt = (v[i] - v[i - 1]) / dt;
    if (dvdt > maxDvDt) {
      maxDvDt = dvdt;
    }
  }
  return maxDvDt;
}

function runSingleCycle(simParams) {
  const {
    dt, inicio, duracao, amplitude, BCL_S1, intervalo_S2, num_estimulos_s1, cellType
  } = simParams;

  const tempo_total = inicio + (num_estimulos_s1 - 1) * BCL_S1 + intervalo_S2 + 1.5 * BCL_S1;
  const passos = parseInt(tempo_total / dt, 10);

  const u_arr = new Float32Array(passos);
  const cai_arr = new Float32Array(passos);
  const nai_arr = new Float32Array(passos);
  const ki_arr = new Float32Array(passos);
  const tempo = new Float32Array(passos);

  let sm = 0.0, sh = 0.75, sj = 0.75, sxr1 = 0.0, sxr2 = 1.0;
  let sxs = 0.0, ss = 1.0, sr = 0.0, sd = 0.0, sf = 1.0;
  let sfca = 1.0, sg = 1.0, Cai = 0.0002, CaSR = 0.2;
  let Nai = 11.6, Ki = 138.3, svolt = -86.2;

  let ctype = 0;
  if (cellType === 'endo') ctype = 1;
  else if (cellType === 'myo') ctype = 2;

  for (let i = 0; i < passos; i++) {
    let t = i * dt;
    tempo[i] = t;
    let stim = 0;

    for (let j = 0; j < num_estimulos_s1; j++) {
      const startS1 = inicio + j * BCL_S1;
      if (t >= startS1 && t < startS1 + duracao) {
        stim = amplitude * 50.0;
        break;
      }
    }
    const startS2 = inicio + (num_estimulos_s1 - 1) * BCL_S1 + intervalo_S2;
    if (t >= startS2 && t < startS2 + duracao) {
      stim = amplitude * 50.0;
    }

    let safe_Cai  = Math.max(Cai, 1e-7);
    let safe_CaSR = Math.max(CaSR, 1e-7);
    let safe_Nai  = Math.max(Nai, 1e-7);
    let safe_Ki   = Math.max(Ki, 1e-7);

    let Ko = 5.4, Cao = 2.0, Nao = 140.0;
    let Vc = 0.016404, Vsr = 0.001094;
    let Bufc = 0.15, Kbufc = 0.001, Bufsr = 10.0, Kbufsr = 0.3;
    let taufca = 2.0, taug = 2.0, Vmaxup = 0.000425, Kup = 0.00025;
    let R = 8314.472, F = 96485.3415, T = 310.0;
    let RTONF = (R * T) / F;
    let CAPACITANCE = 0.185;

    let Gkr = 0.096, pKNa = 0.03, GK1 = 5.405, GNa = 14.838;
    let GbNa = 0.00029, KmK = 1.0, KmNa = 40.0, knak = 1.362;
    let GCaL = 0.000175, GbCa = 0.000592, knaca = 1000.0, KmNai = 87.5;
    let KmCa = 1.38, ksat = 0.1, n = 0.35, GpCa = 0.825;
    let KpCa = 0.0005, GpK = 0.0146;

    let Gks = 0.245, Gto = 0.294;
    if (ctype === 1) { Gks = 0.245; Gto = 0.073; }
    else if (ctype === 2) { Gks = 0.062; Gto = 0.294; }

    let inverseVcF2 = 1.0 / (2.0 * Vc * F);
    let inverseVcF = 1.0 / (Vc * F);
    let Kupsquare = Kup * Kup;
    let exptaufca = Math.exp(-dt / taufca);
    let exptaug = Math.exp(-dt / taug);

    let Ek = RTONF * Math.log(Ko / safe_Ki);
    let Ena = RTONF * Math.log(Nao / safe_Nai);
    let Eks = RTONF * Math.log((Ko + pKNa * Nao) / (safe_Ki + pKNa * safe_Nai));
    let Eca = 0.5 * RTONF * Math.log(Cao / safe_Cai);

    let Ak1 = 0.1 / (1.0 + Math.exp(0.06 * (svolt - Ek - 200.0)));
    let Bk1 = (3.0 * Math.exp(0.0002 * (svolt - Ek + 100.0)) + Math.exp(0.1 * (svolt - Ek - 10.0))) / (1.0 + Math.exp(-0.5 * (svolt - Ek)));
    let rec_iK1 = Ak1 / (Ak1 + Bk1);
    let rec_iNaK = 1.0 / (1.0 + 0.1245 * Math.exp(-0.1 * svolt * F / (R * T)) + 0.0353 * Math.exp(-svolt * F / (R * T)));
    let rec_ipK = 1.0 / (1.0 + Math.exp((25.0 - svolt) / 5.98));

    let INa = GNa * sm * sm * sm * sh * sj * (svolt - Ena);
    let ICaL = GCaL * sd * sf * sfca * 4.0 * svolt * (F * F / (R * T)) *
               (Math.exp(2.0 * svolt * F / (R * T)) * safe_Cai - 0.341 * Cao) / (Math.exp(2.0 * svolt * F / (R * T)) - 1.0);
    let Ito = Gto * sr * ss * (svolt - Ek);
    let IKr = Gkr * Math.sqrt(Ko / 5.4) * sxr1 * sxr2 * (svolt - Ek);
    let IKs = Gks * sxs * sxs * (svolt - Eks);
    let IK1 = GK1 * rec_iK1 * (svolt - Ek);
    
    let INaCa = knaca * (1.0 / (KmNai * KmNai * KmNai + Nao * Nao * Nao)) * (1.0 / (KmCa + Cao)) *
                (1.0 / (1.0 + ksat * Math.exp((n - 1.0) * svolt * F / (R * T)))) *
                (Math.exp(n * svolt * F / (R * T)) * safe_Nai * safe_Nai * safe_Nai * Cao -
                 Math.exp((n - 1.0) * svolt * F / (R * T)) * Nao * Nao * Nao * safe_Cai * 2.5);
                 
    let INaK = knak * (Ko / (Ko + KmK)) * (safe_Nai / (safe_Nai + KmNa)) * rec_iNaK;
    let IpCa = GpCa * safe_Cai / (KpCa + safe_Cai);
    let IpK = GpK * rec_ipK * (svolt - Ek);
    let IbNa = GbNa * (svolt - Ena);
    let IbCa = GbCa * (svolt - Eca);

    let I_ion = IKr + IKs + IK1 + Ito + INa + IbNa + ICaL + IbCa + INaK + INaCa + IpCa + IpK;

    let Caisquare = safe_Cai * safe_Cai;
    let CaSRsquare = safe_CaSR * safe_CaSR;
    let CaCurrent = -(ICaL + IbCa + IpCa - 2.0 * INaCa) * inverseVcF2 * CAPACITANCE;
    let A = 0.016464 * CaSRsquare / (0.0625 + CaSRsquare) + 0.008232;
    let Irel = A * sd * sg;
    let Ileak = 0.00008 * (safe_CaSR - safe_Cai);
    let SERCA = Vmaxup / (1.0 + (Kupsquare / Caisquare));
    let CaSRCurrent = SERCA - Irel - Ileak;
    let CaCSQN = Bufsr * safe_CaSR / (safe_CaSR + Kbufsr);
    let dCaSR = dt * (Vc / Vsr) * CaSRCurrent;
    
    let bjsr = Bufsr - CaCSQN - dCaSR - safe_CaSR + Kbufsr;
    let cjsr = Kbufsr * (CaCSQN + dCaSR + safe_CaSR);
    CaSR = (Math.sqrt(Math.max(bjsr * bjsr + 4.0 * cjsr, 0.0)) - bjsr) / 2.0;

    let CaBuf = Bufc * safe_Cai / (safe_Cai + Kbufc);
    let dCai = dt * (CaCurrent - CaSRCurrent);
    let bc = Bufc - CaBuf - dCai - safe_Cai + Kbufc;
    let cc = Kbufc * (CaBuf + dCai + safe_Cai);
    Cai = (Math.sqrt(Math.max(bc * bc + 4.0 * cc, 0.0)) - bc) / 2.0;

    let dNai = -(INa + IbNa + 3.0 * INaK + 3.0 * INaCa) * inverseVcF * CAPACITANCE;
    Nai = safe_Nai + dt * dNai;

    let dKi = -(stim + IK1 + Ito + IKr + IKs - 2.0 * INaK + IpK) * inverseVcF * CAPACITANCE;
    Ki = safe_Ki + dt * dKi;

    let AM = 1.0 / (1.0 + Math.exp((-60.0 - svolt) / 5.0));
    let BM = 0.1 / (1.0 + Math.exp((svolt + 35.0) / 5.0)) + 0.10 / (1.0 + Math.exp((svolt - 50.0) / 200.0));
    let TAU_M = AM * BM;
    let M_INF = 1.0 / ((1.0 + Math.exp((-56.86 - svolt) / 9.03)) * (1.0 + Math.exp((-56.86 - svolt) / 9.03)));

    let AH_1 = 0.0, BH_1 = 0.0, TAU_H = 0.0;
    if (svolt >= -40.0) {
        BH_1 = 0.77 / (0.13 * (1.0 + Math.exp(-(svolt + 10.66) / 11.1)));
        TAU_H = 1.0 / (AH_1 + BH_1);
    } else {
        let AH_2 = 0.057 * Math.exp(-(svolt + 80.0) / 6.8);
        let BH_2 = 2.7 * Math.exp(0.079 * svolt) + 3.1e5 * Math.exp(0.3485 * svolt);
        TAU_H = 1.0 / (AH_2 + BH_2);
    }
    let H_INF = 1.0 / ((1.0 + Math.exp((svolt + 71.55) / 7.43)) * (1.0 + Math.exp((svolt + 71.55) / 7.43)));

    let AJ_1 = 0.0, BJ_1 = 0.0, TAU_J = 0.0;
    if (svolt >= -40.0) {
        BJ_1 = 0.6 * Math.exp(0.057 * svolt) / (1.0 + Math.exp(-0.1 * (svolt + 32.0)));
        TAU_J = 1.0 / (AJ_1 + BJ_1);
    } else {
        let AJ_2 = (-2.5428e4 * Math.exp(0.2444 * svolt) - 6.948e-6 * Math.exp(-0.04391 * svolt)) * (svolt + 37.78) / (1.0 + Math.exp(0.311 * (svolt + 79.23)));
        let BJ_2 = 0.02424 * Math.exp(-0.01052 * svolt) / (1.0 + Math.exp(-0.1378 * (svolt + 40.14)));
        TAU_J = 1.0 / (AJ_2 + BJ_2);
    }
    let J_INF = H_INF;

    let Xr1_INF = 1.0 / (1.0 + Math.exp((-26.0 - svolt) / 7.0));
    let axr1 = 450.0 / (1.0 + Math.exp((-45.0 - svolt) / 10.0));
    let bxr1 = 6.0 / (1.0 + Math.exp((svolt - (-30.0)) / 11.5));
    let TAU_Xr1 = axr1 * bxr1;

    let Xr2_INF = 1.0 / (1.0 + Math.exp((svolt - (-88.0)) / 24.0));
    let axr2 = 3.0 / (1.0 + Math.exp((-60.0 - svolt) / 20.0));
    let bxr2 = 1.12 / (1.0 + Math.exp((svolt - 60.0) / 20.0));
    let TAU_Xr2 = axr2 * bxr2;

    let Xs_INF = 1.0 / (1.0 + Math.exp((-5.0 - svolt) / 14.0));
    let Axs = 1100.0 / Math.sqrt(1.0 + Math.exp((-10.0 - svolt) / 6.0));
    let Bxs = 1.0 / (1.0 + Math.exp((svolt - 60.0) / 20.0));
    let TAU_Xs = Axs * Bxs;

    let R_INF = 0, S_INF = 0, TAU_R = 0, TAU_S = 0;
    if (ctype === 0) { 
        R_INF = 1.0 / (1.0 + Math.exp((20.0 - svolt) / 6.0));
        S_INF = 1.0 / (1.0 + Math.exp((svolt + 20.0) / 5.0));
        TAU_R = 9.5 * Math.exp(-(svolt + 40.0) * (svolt + 40.0) / 1800.0) + 0.8;
        TAU_S = 85.0 * Math.exp(-(svolt + 45.0) * (svolt + 45.0) / 320.0) + 5.0 / (1.0 + Math.exp((svolt - 20.0) / 5.0)) + 3.0;
    } else if (ctype === 1) {
        R_INF = 1.0 / (1.0 + Math.exp((20.0 - svolt) / 6.0));
        S_INF = 1.0 / (1.0 + Math.exp((svolt + 28.0) / 5.0));
        TAU_R = 9.5 * Math.exp(-(svolt + 40.0) * (svolt + 40.0) / 1800.0) + 0.8;
        TAU_S = 1000.0 * Math.exp(-(svolt + 67.0) * (svolt + 67.0) / 1000.0) + 8.0;
    } else { 
        R_INF = 1.0 / (1.0 + Math.exp((20.0 - svolt) / 6.0));
        S_INF = 1.0 / (1.0 + Math.exp((svolt + 20.0) / 5.0));
        TAU_R = 9.5 * Math.exp(-(svolt + 40.0) * (svolt + 40.0) / 1800.0) + 0.8;
        TAU_S = 85.0 * Math.exp(-(svolt + 45.0) * (svolt + 45.0) / 320.0) + 5.0 / (1.0 + Math.exp((svolt - 20.0) / 5.0)) + 3.0;
    }

    let D_INF = 1.0 / (1.0 + Math.exp((-5.0 - svolt) / 7.5));
    let Ad = 1.4 / (1.0 + Math.exp((-35.0 - svolt) / 13.0)) + 0.25;
    let Bd = 1.4 / (1.0 + Math.exp((svolt + 5.0) / 5.0));
    let Cd = 1.0 / (1.0 + Math.exp((50.0 - svolt) / 20.0));
    let TAU_D = Ad * Bd + Cd;

    let F_INF = 1.0 / (1.0 + Math.exp((svolt + 20.0) / 7.0));
    let TAU_F = 1125.0 * Math.exp(-(svolt + 27.0) * (svolt + 27.0) / 300.0) + 80.0 + 165.0 / (1.0 + Math.exp((25.0 - svolt) / 10.0));

    let FCa_INF = (1.0 / (1.0 + Math.pow(safe_Cai / 0.000325, 8.0)) +
                   0.1 / (1.0 + Math.exp((safe_Cai - 0.0005) / 0.0001)) +
                   0.20 / (1.0 + Math.exp((safe_Cai - 0.00075) / 0.0008)) +
                   0.23) / 1.46;

    let G_INF = 0;
    if (safe_Cai < 0.00035) {
        G_INF = 1.0 / (1.0 + Math.pow(safe_Cai / 0.00035, 6.0));
    } else {
        G_INF = 1.0 / (1.0 + Math.pow(safe_Cai / 0.00035, 16.0));
    }

    sm = M_INF - (M_INF - sm) * Math.exp(-dt / TAU_M);
    sh = H_INF - (H_INF - sh) * Math.exp(-dt / TAU_H);
    sj = J_INF - (J_INF - sj) * Math.exp(-dt / TAU_J);
    sxr1 = Xr1_INF - (Xr1_INF - sxr1) * Math.exp(-dt / TAU_Xr1);
    sxr2 = Xr2_INF - (Xr2_INF - sxr2) * Math.exp(-dt / TAU_Xr2);
    sxs = Xs_INF - (Xs_INF - sxs) * Math.exp(-dt / TAU_Xs);
    ss = S_INF - (S_INF - ss) * Math.exp(-dt / TAU_S);
    sr = R_INF - (R_INF - sr) * Math.exp(-dt / TAU_R);
    sd = D_INF - (D_INF - sd) * Math.exp(-dt / TAU_D);
    sf = F_INF - (F_INF - sf) * Math.exp(-dt / TAU_F);

    let next_sfca = FCa_INF - (FCa_INF - sfca) * exptaufca;
    if (next_sfca > sfca && svolt > -37.0) { next_sfca = sfca; }
    sfca = next_sfca;

    let next_sg = G_INF - (G_INF - sg) * exptaug;
    if (next_sg > sg && svolt > -37.0) { next_sg = sg; }
    sg = next_sg;

    svolt = svolt + dt * (-I_ion + stim);

    u_arr[i] = svolt;
    cai_arr[i] = Cai;
    nai_arr[i] = Nai;
    ki_arr[i] = Ki;
  }

  const inicio_ultimo_s1_idx = Math.round((inicio + (num_estimulos_s1 - 1) * BCL_S1) / dt);
  const slice_duration_idx = Math.round(1.5 * BCL_S1 / dt);
  const u_s1 = u_arr.slice(inicio_ultimo_s1_idx, inicio_ultimo_s1_idx + slice_duration_idx);

  const inicio_s2_idx = Math.round((inicio + (num_estimulos_s1 - 1) * BCL_S1 + intervalo_S2) / dt);
  const u_s2 = u_arr.slice(inicio_s2_idx, inicio_s2_idx + slice_duration_idx);

  return { u_s1, u_s2, full_u: u_arr, full_cai: cai_arr, full_nai: nai_arr, full_ki: ki_arr, full_tempo: tempo };
}

self.onmessage = (e) => {
  const params = e.data;
  const {
    BCL_S2_inicial, BCL_S2_final, delta_CL, downsamplingFactor, cellType = 'epi', dt, amplitude, duracao = 1.0, S1 = 400, num_estimulos_s1 = 5, inicio = 10.0
  } = params;

  const num_ciclos = Math.floor((BCL_S2_inicial - BCL_S2_final) / delta_CL) + 1;
  const restitutionData = [];
  const allTimeSeriesData = [];
  let tempo_offset = 0;

  for (let ciclo = 0; ciclo < num_ciclos; ciclo++) {
    const intervalo_S2 = BCL_S2_inicial - (ciclo * delta_CL);
    if (intervalo_S2 < BCL_S2_final) continue;

    const cycleSimParams = { ...params, intervalo_S2, BCL_S1: S1, num_estimulos_s1: num_estimulos_s1, duracao: duracao, inicio: inicio, amplitude: amplitude };
    const { u_s1, u_s2, full_u, full_cai, full_nai, full_ki, full_tempo } = runSingleCycle(cycleSimParams);

    const apd_s1 = calculateAPD90(u_s1, dt, -86.2);
    const apd_s2 = calculateAPD90(u_s2, dt, -86.2);
    const dvdt_max_s2 = calculateDvDtMax(u_s2, dt);

    if (apd_s1 > 0 && apd_s2 > 0) {
      const di = intervalo_S2 - apd_s1;
      if (di > 0) {
        restitutionData.push({ bcl: di, apd: apd_s2, dvdt_max: dvdt_max_s2 });
      }
    }

    for (let i = 0; i < full_u.length; i += downsamplingFactor) {
      if (full_tempo[i] !== undefined) {
        allTimeSeriesData.push({
          tempo: (tempo_offset + full_tempo[i]).toFixed(2),
          v: full_u[i],
          Cai: full_cai[i],
          Nai: full_nai[i],
          Ki: full_ki[i]
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
