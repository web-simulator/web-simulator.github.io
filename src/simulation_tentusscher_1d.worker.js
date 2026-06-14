self.onmessage = (e) => {
  const params = e.data;
  let {
    L = 30, dx = 0.1, dt = 0.02, totalTime = 500, cellType = 'epi',
    inicio = 5.0, duracao = 1.0, amplitude = 2.0, downsamplingFactor = 50,
    posição_do_estímulo, tamanho_do_estímulo, num_estimulos = 1, BCL = 1000, D = 0.154
  } = params;

  const posicao_estimulo = posição_do_estímulo || params.posicao_estimulo || 5;
  const tamanho_estimulo = tamanho_do_estímulo || params.tamanho_estimulo || 5;

  const N = Math.floor(L / dx);
  const steps = Math.floor(totalTime / dt);
  
  let ctype = 0;
  if (cellType === 'endo') ctype = 1;
  else if (cellType === 'myo') ctype = 2;

  // Constants
  const R = 8314.472, T = 310.0, F = 96485.3415;
  const RTONF = (R * T) / F;
  const CAPACITANCE = 0.185;

  const Ko = 5.4, Cao = 2.0, Nao = 140.0;
  const Vc = 0.016404, Vsr = 0.001094;
  const Bufc = 0.15, Kbufc = 0.001, Bufsr = 10.0, Kbufsr = 0.3;

  // Arrays
  let v = new Float32Array(N).fill(-86.2);
  let v_prev = new Float32Array(N);

  let sm = new Float32Array(N).fill(0.0);
  let sh = new Float32Array(N).fill(0.75);
  let sj = new Float32Array(N).fill(0.75);
  let sxr1 = new Float32Array(N).fill(0.0);
  let sxr2 = new Float32Array(N).fill(1.0);
  let sxs = new Float32Array(N).fill(0.0);
  let ss = new Float32Array(N).fill(1.0);
  let sr = new Float32Array(N).fill(0.0);
  let sd = new Float32Array(N).fill(0.0);
  let sf = new Float32Array(N).fill(1.0);
  let sfca = new Float32Array(N).fill(1.0);
  let sg = new Float32Array(N).fill(1.0);
  let Cai = new Float32Array(N).fill(0.0002);
  let CaSR = new Float32Array(N).fill(0.2);
  let Nai = new Float32Array(N).fill(11.6);
  let Ki = new Float32Array(N).fill(138.3);

  const outputData = [];

  const stim_center_idx = Math.floor(posicao_estimulo / dx);
  const stim_half_idx = Math.floor(tamanho_estimulo / (2 * dx));
  const stim_start_idx = Math.max(1, stim_center_idx - stim_half_idx);
  const stim_end_idx = Math.min(N - 2, stim_center_idx + stim_half_idx);

  for (let t = 0; t < steps; t++) {
    const time = t * dt;
    
    let current_stim = 0.0;
    for (let s = 0; s < num_estimulos; s++) {
      let t_stim = inicio + s * BCL;
      if (time >= t_stim && time < t_stim + duracao) {
        current_stim = amplitude * 50.0;
        break;
      }
    }

    v_prev.set(v);

    for (let idx = 1; idx < N - 1; idx++) {
      let svolt = v_prev[idx];

      let safe_Cai = Math.max(Cai[idx], 1e-7);
      let safe_CaSR = Math.max(CaSR[idx], 1e-7);
      let safe_Nai = Math.max(Nai[idx], 1e-7);
      let safe_Ki = Math.max(Ki[idx], 1e-7);

      let GNa = 14.838, GK1 = 5.405, GKr = 0.096;
      let Gks = 0.245, Gto = 0.294;
      if (ctype === 1) { Gks = 0.245; Gto = 0.073; }
      else if (ctype === 2) { Gks = 0.062; Gto = 0.294; }

      let pKNa = 0.03, GbNa = 0.00029, KmK = 1.0, KmNa = 40.0;
      let knak = 1.362, GCaL = 0.000175, GbCa = 0.000592;
      let knaca = 1000.0, KmNai = 87.5, KmCa = 1.38, ksat = 0.1, n_ca = 0.35;
      let GpCa = 0.825, KpCa = 0.0005, GpK = 0.0146;

      let Ek = RTONF * Math.log(Ko / safe_Ki);
      let Ena = RTONF * Math.log(Nao / safe_Nai);
      let Eks = RTONF * Math.log((Ko + pKNa * Nao) / (safe_Ki + pKNa * safe_Nai));
      let Eca = 0.5 * RTONF * Math.log(Cao / safe_Cai);

      // Correntes
      let Ak1 = 0.1 / (1.0 + Math.exp(0.06 * (svolt - Ek - 200.0)));
      let Bk1 = (3.0 * Math.exp(0.0002 * (svolt - Ek + 100.0)) + Math.exp(0.1 * (svolt - Ek - 10.0))) / (1.0 + Math.exp(-0.5 * (svolt - Ek)));
      let rec_iK1 = Ak1 / (Ak1 + Bk1);
      let rec_iNaK = 1.0 / (1.0 + 0.1245 * Math.exp(-0.1 * svolt * F / (R * T)) + 0.0353 * Math.exp(-svolt * F / (R * T)));
      let rec_ipK = 1.0 / (1.0 + Math.exp((25.0 - svolt) / 5.98));

      let INa = GNa * Math.pow(sm[idx], 3) * sh[idx] * sj[idx] * (svolt - Ena);
      let vffrt = 2.0 * svolt * F / (R * T);
      let vffrt_exp = Math.exp(vffrt);
      let denom = vffrt_exp - 1.0;
      if (Math.abs(denom) < 1e-6) denom = 1e-6; 
      
      let ICaL = GCaL * sd[idx] * sf[idx] * sfca[idx] * 4.0 * svolt * (F * F / (R * T)) *
                 (vffrt_exp * safe_Cai - 0.341 * Cao) / denom;
      let Ito = Gto * sr[idx] * ss[idx] * (svolt - Ek);
      let IKr = GKr * Math.sqrt(Ko / 5.4) * sxr1[idx] * sxr2[idx] * (svolt - Ek);
      let IKs = Gks * Math.pow(sxs[idx], 2) * (svolt - Eks);
      let IK1 = GK1 * rec_iK1 * (svolt - Ek);
      
      let INaCa = knaca * (1.0 / (Math.pow(KmNai, 3) + Math.pow(Nao, 3))) * (1.0 / (KmCa + Cao)) *
                  (1.0 / (1.0 + ksat * Math.exp((n_ca - 1.0) * svolt * F / (R * T)))) *
                  (Math.exp(n_ca * svolt * F / (R * T)) * Math.pow(safe_Nai, 3) * Cao -
                   Math.exp((n_ca - 1.0) * svolt * F / (R * T)) * Math.pow(Nao, 3) * safe_Cai * 2.5);
                   
      let INaK = knak * (Ko / (Ko + KmK)) * (safe_Nai / (safe_Nai + KmNa)) * rec_iNaK;
      let IpCa = GpCa * safe_Cai / (KpCa + safe_Cai);
      let IpK = GpK * rec_ipK * (svolt - Ek);
      let IbNa = GbNa * (svolt - Ena);
      let IbCa = GbCa * (svolt - Eca);

      let I_ion = IKr + IKs + IK1 + Ito + INa + IbNa + ICaL + IbCa + INaK + INaCa + IpCa + IpK;

      // Cálcio
      let Caisquare = safe_Cai * safe_Cai;
      let CaSRsquare = safe_CaSR * safe_CaSR;
      let CaCurrent = -(ICaL + IbCa + IpCa - 2.0 * INaCa) * 1.0 / (2.0 * Vc * F) * CAPACITANCE;
      
      let A_rel = 0.016464 * CaSRsquare / (0.0625 + CaSRsquare) + 0.008232;
      let Irel = A_rel * sd[idx] * sg[idx];
      let Vmax_up = 0.000425, Kup = 0.00025;
      let Iup = Vmax_up / (1.0 + (Kup * Kup) / Caisquare);
      let I_leak = 0.00008 * (safe_CaSR - safe_Cai);

      let CaSRCurrent = Iup - Irel - I_leak;
      let CaCSQN = Bufsr * safe_CaSR / (safe_CaSR + Kbufsr);
      let dCaSR = dt * (Vc / Vsr) * CaSRCurrent;
      let bjsr = Bufsr - CaCSQN - dCaSR - safe_CaSR + Kbufsr;
      let cjsr = Kbufsr * (CaCSQN + dCaSR + safe_CaSR);
      CaSR[idx] = (Math.sqrt(Math.max(bjsr * bjsr + 4.0 * cjsr, 0.0)) - bjsr) / 2.0;

      let CaBuf = Bufc * safe_Cai / (safe_Cai + Kbufc);
      let dCai = dt * (CaCurrent - CaSRCurrent);
      let bc = Bufc - CaBuf - dCai - safe_Cai + Kbufc;
      let cc = Kbufc * (CaBuf + dCai + safe_Cai);
      Cai[idx] = (Math.sqrt(Math.max(bc * bc + 4.0 * cc, 0.0)) - bc) / 2.0;

      // Concentrações Iônicas
      let dNai = -(INa + IbNa + 3.0 * INaK + 3.0 * INaCa) * 1.0 / (Vc * F) * CAPACITANCE;
      Nai[idx] = safe_Nai + dt * dNai;
      let dKi = -(Ito + IKr + IKs + IK1 + IpK - 2.0 * INaK) * 1.0 / (Vc * F) * CAPACITANCE;
      Ki[idx] = safe_Ki + dt * dKi;

      // Gates (Rush-Larsen)
      let m_inf = 1.0 / Math.pow(1.0 + Math.exp((-56.86 - svolt) / 9.03), 2);
      let a_m = 1.0 / (1.0 + Math.exp((-60.0 - svolt) / 5.0));
      let b_m = 0.1 / (1.0 + Math.exp((svolt + 35.0) / 5.0)) + 0.1 / (1.0 + Math.exp((svolt - 50.0) / 200.0));
      let tau_m = Math.max(a_m * b_m, 1e-4);
      sm[idx] = m_inf - (m_inf - sm[idx]) * Math.exp(-dt / tau_m);

      let h_inf = 1.0 / Math.pow(1.0 + Math.exp((svolt + 71.55) / 7.43), 2);
      let a_h = 0.0, b_h = 0.0;
      if (svolt < -40.0) {
        a_h = 0.057 * Math.exp(-(svolt + 80.0) / 6.8);
        b_h = 2.7 * Math.exp(0.079 * svolt) + 3.1e5 * Math.exp(0.3485 * svolt);
      } else {
        b_h = 0.77 / (0.13 * (1.0 + Math.exp(-(svolt + 10.66) / 11.1)));
      }
      let tau_h = Math.max(1.0 / (a_h + b_h), 1e-4);
      sh[idx] = h_inf - (h_inf - sh[idx]) * Math.exp(-dt / tau_h);

      let j_inf = 1.0 / Math.pow(1.0 + Math.exp((svolt + 71.55) / 7.43), 2);
      let a_j = 0.0, b_j = 0.0;
      if (svolt < -40.0) {
        a_j = (-25428.0 * Math.exp(0.2444 * svolt) - 6.948e-6 * Math.exp(-0.04391 * svolt)) * (svolt + 37.78) / (1.0 + Math.exp(0.311 * (svolt + 79.23)));
        b_j = 0.02424 * Math.exp(-0.01052 * svolt) / (1.0 + Math.exp(-0.1378 * (svolt + 40.14)));
      } else {
        b_j = 0.6 * Math.exp(0.057 * svolt) / (1.0 + Math.exp(-0.1 * (svolt + 32.0)));
      }
      let tau_j = Math.max(1.0 / (a_j + b_j), 1e-4);
      sj[idx] = j_inf - (j_inf - sj[idx]) * Math.exp(-dt / tau_j);

      let xr1_inf = 1.0 / (1.0 + Math.exp((-26.0 - svolt) / 7.0));
      let a_xr1 = 450.0 / (1.0 + Math.exp((-45.0 - svolt) / 10.0));
      let b_xr1 = 6.0 / (1.0 + Math.exp((svolt + 30.0) / 11.5));
      let tau_xr1 = Math.max(a_xr1 * b_xr1, 1e-4);
      sxr1[idx] = xr1_inf - (xr1_inf - sxr1[idx]) * Math.exp(-dt / tau_xr1);

      let xr2_inf = 1.0 / (1.0 + Math.exp((svolt + 88.0) / 24.0));
      let a_xr2 = 3.0 / (1.0 + Math.exp((-60.0 - svolt) / 20.0));
      let b_xr2 = 1.12 / (1.0 + Math.exp((svolt - 60.0) / 20.0));
      let tau_xr2 = Math.max(a_xr2 * b_xr2, 1e-4);
      sxr2[idx] = xr2_inf - (xr2_inf - sxr2[idx]) * Math.exp(-dt / tau_xr2);

      let xs_inf = 1.0 / (1.0 + Math.exp((-5.0 - svolt) / 14.0));
      let a_xs = 1100.0 / Math.sqrt(1.0 + Math.exp((-10.0 - svolt) / 6.0));
      let b_xs = 1.0 / (1.0 + Math.exp((svolt - 60.0) / 20.0));
      let tau_xs = Math.max(a_xs * b_xs, 1e-4);
      sxs[idx] = xs_inf - (xs_inf - sxs[idx]) * Math.exp(-dt / tau_xs);

      let s_inf = 1.0 / (1.0 + Math.exp((svolt + 20.0) / 5.0));
      let tau_s = Math.max(85.0 * Math.exp(-Math.pow(svolt + 45.0, 2) / 320.0) + 5.0 / (1.0 + Math.exp((svolt - 20.0) / 5.0)) + 3.0, 1e-4);
      if (ctype === 1) { // Endo
         s_inf = 1.0 / (1.0 + Math.exp((svolt + 28.0) / 5.0));
         tau_s = 1000.0 * Math.exp(-Math.pow(svolt + 67.0, 2) / 1000.0) + 8.0;
      }
      ss[idx] = s_inf - (s_inf - ss[idx]) * Math.exp(-dt / tau_s);

      let r_inf = 1.0 / (1.0 + Math.exp((20.0 - svolt) / 6.0));
      let tau_r = Math.max(9.5 * Math.exp(-Math.pow(svolt + 40.0, 2) / 1800.0) + 0.8, 1e-4);
      sr[idx] = r_inf - (r_inf - sr[idx]) * Math.exp(-dt / tau_r);

      let d_inf = 1.0 / (1.0 + Math.exp((-5.0 - svolt) / 7.5));
      let a_d = 1.4 / (1.0 + Math.exp((-35.0 - svolt) / 13.0)) + 0.25;
      let b_d = 1.4 / (1.0 + Math.exp((svolt + 5.0) / 5.0));
      let c_d = 1.0 / (1.0 + Math.exp((50.0 - svolt) / 20.0));
      let tau_d = Math.max(a_d * b_d + c_d, 1e-4);
      sd[idx] = d_inf - (d_inf - sd[idx]) * Math.exp(-dt / tau_d);

      let f_inf = 1.0 / (1.0 + Math.exp((svolt + 20.0) / 7.0));
      let tau_f = Math.max(1125.0 * Math.exp(-Math.pow(svolt + 27.0, 2) / 300.0) + 80.0 + 165.0 / (1.0 + Math.exp((25.0 - svolt) / 10.0)), 1e-4);
      sf[idx] = f_inf - (f_inf - sf[idx]) * Math.exp(-dt / tau_f);

      // sfca robusto
      let fca_inf = (1.0 / (1.0 + Math.pow(safe_Cai / 0.000325, 8.0)) +
                     0.1 / (1.0 + Math.exp((safe_Cai - 0.0005) / 0.0001)) +
                     0.20 / (1.0 + Math.exp((safe_Cai - 0.00075) / 0.0008)) +
                     0.23) / 1.46;
      let sfca_old = sfca[idx];
      sfca[idx] = fca_inf - (fca_inf - sfca_old) * Math.exp(-dt / 2.0);
      if (sfca[idx] > sfca_old && svolt > -37.0) sfca[idx] = sfca_old;

      // sg robusto
      let g_inf = (safe_Cai < 0.00035) 
        ? 1.0 / (1.0 + Math.pow(safe_Cai / 0.00035, 6.0)) 
        : 1.0 / (1.0 + Math.pow(safe_Cai / 0.00035, 16.0));
      let sg_old = sg[idx];
      sg[idx] = g_inf - (g_inf - sg_old) * Math.exp(-dt / 2.0);
      if (sg[idx] > sg_old && svolt > -37.0) sg[idx] = sg_old;

      // Difusão
      let v_left = svolt;
      if (idx > 0) v_left = v_prev[idx - 1];

      let v_right = svolt;
      if (idx < N - 1) v_right = v_prev[idx + 1];

      let lap_v = (v_left - 2.0 * svolt + v_right) / (dx * dx);

      let stim = 0.0;
      if (idx >= stim_start_idx && idx <= stim_end_idx) {
        stim = current_stim;
      }

      // Atualização da voltagem
      let v_next = svolt + dt * (D * lap_v - I_ion + stim);
      if (v_next < -120.0) v_next = -120.0;
      if (v_next > 80.0) v_next = 80.0;
      
      v[idx] = v_next;
    }

    // Condições de Contorno
    v[0] = v[1];
    v[N - 1] = v[N - 2];

    if (t % downsamplingFactor === 0) {
      const snapshot = new Array(N);
      for (let i = 0; i < N; i++) {
        snapshot[i] = { x: i * dx, v: v[i], tempo: time.toFixed(2) };
      }
      outputData.push({ time: time.toFixed(2), data: snapshot });
    }
  }

  self.postMessage(outputData);
};