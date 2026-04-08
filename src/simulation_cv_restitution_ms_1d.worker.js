self.onmessage = (e) => {
  const params = e.data;
  let {
    k, Tau_in, Tau_out, Tau_open, Tau_close, gate,
    L, dx, dt, inicio, duracao, amplitude,
    posição_do_estímulo, tamanho_do_estímulo,
    num_estimulos, BCL_S1, BCL_S2_inicial, BCL_S2_final, delta_CL
  } = params;

  // Ajuste do passo de tempo para garantir a estabilidade do método numérico (CFL)
  let safe_dt = dt;
  const cfl_limit = (dx * dx) / (2 * k);
  if (safe_dt > cfl_limit) {
    safe_dt = cfl_limit * 0.9; 
  }

  const N = Math.floor(L / dx); 
  const num_ciclos = Math.floor((BCL_S2_inicial - BCL_S2_final) / delta_CL) + 1;
  const restitutionData = [];

  // Posições de medição no cabo (25% e 75%)
  const x1_idx = Math.floor(0.25 * N);
  const x2_idx = Math.floor(0.75 * N);
  const distance = Math.abs(x2_idx - x1_idx) * dx;

  // Região que recebe o estímulo inicial
  const stimulus_center_index = Math.floor(posição_do_estímulo / dx);
  const stimulus_half_size_index = Math.floor(tamanho_do_estímulo / (2 * dx));
  const stim_start_idx = Math.max(1, stimulus_center_index - stimulus_half_size_index);
  const stim_end_idx = Math.min(N - 2, stimulus_center_index + stimulus_half_size_index);

  // Laço varrendo os intervalos de acoplamento S2 (Coupling Interval)
  for (let ciclo = 0; ciclo < num_ciclos; ciclo++) {
    const intervalo_S2 = BCL_S2_inicial - (ciclo * delta_CL);
    if (intervalo_S2 < BCL_S2_final) continue;

    const s1_last_time = inicio + (num_estimulos - 1) * BCL_S1;
    const s2_time = s1_last_time + intervalo_S2;
    const totalTime = s2_time + 1000; 
    const steps = Math.floor(totalTime / safe_dt);

    let v = new Float64Array(N).fill(0);
    let h = new Float64Array(N).fill(1);
    let v_new = new Float64Array(N);
    let h_new = new Float64Array(N);

    // Rastreadores de Ativação Local (LAT)
    let s1_lat1_depol = -1;
    let s1_lat1_repol = -1;
    let s2_lat1_depol = -1;
    let s2_lat2_depol = -1;

    for (let t = 0; t < steps; t++) {
        const current_time = t * safe_dt;

        let is_stim = false;
        // Aplicação do trem de pulsos S1
        for (let i = 0; i < num_estimulos; i++) {
            const p_start = inicio + i * BCL_S1;
            if (current_time >= p_start && current_time < p_start + duracao) {
                is_stim = true; break;
            }
        }
        // Aplicação do pulso S2
        if (current_time >= s2_time && current_time < s2_time + duracao) {
            is_stim = true;
        }
        const current_stimulus = is_stim ? amplitude : 0;

        for (let i = 1; i < N - 1; i++) {
            const vp = v[i];
            const hp = h[i];

            let alpha_h = vp < gate ? 1.0 / Tau_open : 0.0;
            let beta_h = vp >= gate ? 1.0 / Tau_close : 0.0;
            const sum_ab = alpha_h + beta_h;
            if (sum_ab > 0) {
                const h_inf = alpha_h / sum_ab;
                const h_exp = Math.exp(-sum_ab * safe_dt);
                h_new[i] = h_inf + (hp - h_inf) * h_exp;
            } else {
                h_new[i] = hp;
            }

            const diffusion = k * (v[i + 1] - 2 * vp + v[i - 1]) / (dx * dx);
            const J_entrada = (hp * vp ** 2 * (1 - vp)) / Tau_in;
            const J_saida = -vp / Tau_out;
            let stimulus = 0;
            if (i >= stim_start_idx && i <= stim_end_idx) stimulus = current_stimulus;

            v_new[i] = vp + (diffusion + J_entrada + J_saida + stimulus) * safe_dt;
        }

        v_new[0] = v_new[1]; v_new[N - 1] = v_new[N - 2];
        h_new[0] = h_new[1]; h_new[N - 1] = h_new[N - 2];

        // Rastreamento de Despolarização do S1 na célula proximal
        if (current_time >= s1_last_time && current_time < s2_time) {
            if (s1_lat1_depol < 0 && v[x1_idx] < 0.5 && v_new[x1_idx] >= 0.5) {
                s1_lat1_depol = current_time;
            }
        }

        // Rastreamento da Repolarização do S1 (só conta se o S2 ainda não tiver despolarizado)
        if (s2_lat1_depol < 0) {
            if (s1_lat1_depol > 0 && s1_lat1_repol < 0 && v[x1_idx] >= 0.1 && v_new[x1_idx] < 0.1) {
                s1_lat1_repol = current_time;
            }
        }

        // Rastreamento de Despolarização do S2 (Proximal e Distal)
        if (current_time >= s2_time) {
            if (s2_lat1_depol < 0 && v[x1_idx] < 0.5 && v_new[x1_idx] >= 0.5) s2_lat1_depol = current_time;
            if (s2_lat2_depol < 0 && v[x2_idx] < 0.5 && v_new[x2_idx] >= 0.5) s2_lat2_depol = current_time;
        }

        let tmp_v = v; v = v_new; v_new = tmp_v;
        let tmp_h = h; h = h_new; h_new = tmp_h;
    }

    // Só salva se o pulso S2 propagou por ambos os pontos
    if (s2_lat1_depol > 0 && s2_lat2_depol > 0 && s2_lat2_depol > s2_lat1_depol) {
        const cv = distance / (s2_lat2_depol - s2_lat1_depol);
        
        let di = intervalo_S2; 
        // O Intervalo Diastólico real é (Ativação do S2) - (Repolarização do S1) medidos no tecido
        if (s1_lat1_repol > 0 && s2_lat1_depol > s1_lat1_repol) {
            di = s2_lat1_depol - s1_lat1_repol;
        }
        
        restitutionData.push({ ci: intervalo_S2, di: di, cv: cv });
    }
  }

  // Ordena os dados para que o gráfico seja desenhado na direção correta
  restitutionData.sort((a, b) => a.ci - b.ci);
  self.postMessage(restitutionData);
};