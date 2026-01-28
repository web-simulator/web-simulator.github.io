// Função para calcular APD90
function calculateAPD90(v, dt) {
  if (!v || v.length === 0) {
    return 0;
  }

  const v_max = Math.max(...v);
  const v_min = Math.min(...v);
  const amplitude = v_max - v_min;

  // Retorna 0 se não houver um potencial de ação significativo
  if (amplitude < 0.2) {
    return 0;
  }

  // Potencial de repolarização
  const v_repol_90 = v_max - amplitude * 0.9;

  let despolarizacaoIdx = -1;
  let repolarizacaoIdx = -1;

  // Encontra o índice do pico do potencial de ação
  for (let i = 0; i < v.length; i++) {
    if (v[i] >= v_max * 0.98) { // Considera o início perto do pico
      despolarizacaoIdx = i;
      break;
    }
  }

  if (despolarizacaoIdx === -1) {
    return 0; // Pico não encontrado
  }

  // Encontra o índice onde a repolarização atinge 90%
  for (let i = despolarizacaoIdx; i < v.length; i++) {
    if (v[i] <= v_repol_90) {
      repolarizacaoIdx = i;
      break;
    }
  }

  if (repolarizacaoIdx === -1) {
    return 0; // Não repolarizou completamente no tempo analisado
  }

  return (repolarizacaoIdx - despolarizacaoIdx) * dt;
}


// Executa um ciclo de simulação
function runSingleCycle(params) {
  const {
    tau_in, tau_out, tau_open, tau_close, v_gate, dt,
    v_inicial, h_inicial, inicio, duracao, amplitude, BCL_S1, intervalo_S2,
    num_estimulos_s1
  } = params;

  // Calcula o tempo total do ciclo
  const tempo_total = inicio + (num_estimulos_s1 - 1) * BCL_S1 + intervalo_S2 + 1.5 * BCL_S1;
  const passos = parseInt(tempo_total / dt, 10);

  const v = new Array(passos).fill(v_inicial);
  const h = new Array(passos).fill(h_inicial);
  const tempo = new Array(passos);

  // Loop principal
  for (let i = 1; i < passos; i++) {
    tempo[i] = i * dt;
    const t = tempo[i];

    let estimulo = 0;
    // Pulsos S1
    for (let j = 0; j < num_estimulos_s1; j++) {
      const inicio_pulso = inicio + j * BCL_S1;
      if (t >= inicio_pulso && t < inicio_pulso + duracao) {
        estimulo = amplitude;
        break;
      }
    }
    // Pulso S2
    const inicio_s2 = inicio + (num_estimulos_s1 - 1) * BCL_S1 + intervalo_S2;
    if (t >= inicio_s2 && t < inicio_s2 + duracao) {
      estimulo = amplitude;
    }

    const v_prev = v[i - 1];
    const h_prev = h[i - 1];

    // Euler para v
    const J_entrada = (h_prev * v_prev ** 2 * (1 - v_prev)) / tau_in;
    const J_saida = -v_prev / tau_out;
    const dv_dt = J_entrada + J_saida + estimulo;

    const v_next = v_prev + dv_dt * dt;

    // Rush-Larsen para h
    let alpha_h, beta_h;
    if (v_prev < v_gate) {
      alpha_h = 1.0 / tau_open;
      beta_h = 0.0;
    } else {
      alpha_h = 0.0;
      beta_h = 1.0 / tau_close;
    }
    
    const sum_ab = alpha_h + beta_h;
    let h_next;

    if (sum_ab > 0) {
      const h_inf = alpha_h / sum_ab;
      const h_exp = Math.exp(-sum_ab * dt);
      h_next = h_inf + (h_prev - h_inf) * h_exp;
    } else {
      h_next = h_prev;
    }

    // Garante que v e h estejam no intervalo 0, 1
    v[i] = Math.max(0.0, Math.min(1.0, v_next));
    h[i] = Math.max(0.0, Math.min(1.0, h_next));
  }

  // Potencial de ação do último S1 para calcular APD
  const inicio_ultimo_s1_idx = Math.round((inicio + (num_estimulos_s1 - 1) * BCL_S1) / dt);

  const slice_duration_idx = Math.round(1.5 * BCL_S1 / dt);
  const v_s1 = v.slice(inicio_ultimo_s1_idx, inicio_ultimo_s1_idx + slice_duration_idx);
  
  // Potencial de ação do S2 para calcular APD
  const inicio_s2_idx = Math.round((inicio + (num_estimulos_s1 - 1) * BCL_S1 + intervalo_S2) / dt);
  const v_s2 = v.slice(inicio_s2_idx, inicio_s2_idx + slice_duration_idx);
  
  return { v_s1, v_s2, full_v: v, full_h: h, full_tempo: tempo };
}


self.onmessage = (e) => {
  const params = e.data;
  const {
    BCL_S2_inicial, BCL_S2_final, delta_CL, downsamplingFactor
  } = params;

  // Calcula o número de ciclos
  const num_ciclos = Math.floor((BCL_S2_inicial - BCL_S2_final) / delta_CL) + 1;

  const restitutionData = [];
  
  // Arrays para série temporal completa
  const timeResults = [];
  const vResults = [];
  const hResults = [];
  
  let tempo_offset = 0;

  // Construir a curva de restituição
  for (let ciclo = 0; ciclo < num_ciclos; ciclo++) {
    // Calcula o intervalo S2 para o ciclo atual
    const intervalo_S2 = BCL_S2_inicial - (ciclo * delta_CL);
    if (intervalo_S2 < BCL_S2_final) continue; // Garante que não ultrapasse o limite final

    const cycleParams = { ...params, intervalo_S2 };
    const { v_s1, v_s2, full_v, full_h, full_tempo } = runSingleCycle(cycleParams);

    // Calcula APD90 do último S1 e do S2
    const apd_s1 = calculateAPD90(v_s1, params.dt);
    const apd_s2 = calculateAPD90(v_s2, params.dt);

    if (apd_s1 > 0 && apd_s2 > 0) {
      const di = intervalo_S2 - apd_s1; // Calcula o DI
      if (di > 0) {
        restitutionData.push({ bcl: di, apd: apd_s2 }); 
      }
    }

    const len = full_v.length;
    for (let i = 0; i < len; i += downsamplingFactor) {
        if(full_tempo[i] !== undefined) {
            timeResults.push(tempo_offset + full_tempo[i]);
            vResults.push(full_v[i]);
            hResults.push(full_h[i]);
        }
    }
    
    if (full_tempo.length > 0) {
      tempo_offset += full_tempo[full_tempo.length - 1];
    }
  }

  // Ordena os dados da curva pelo DI
  restitutionData.sort((a, b) => a.bcl - b.bcl);

  const timeArr = new Float32Array(timeResults);
  const vArr = new Float32Array(vResults);
  const hArr = new Float32Array(hResults);

  // Envia os dados de volta para o thread principal
  self.postMessage({ 
      timeSeriesData: { 
          time: timeArr, 
          v: vArr, 
          h: hArr 
      }, 
      restitutionData 
  }, [timeArr.buffer, vArr.buffer, hArr.buffer]);
};