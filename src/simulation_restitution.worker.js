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
    despolarização, repolarização, recuperação, inativação, gate, dt,
    v_inicial, h_inicial, inicio, duração, amplitude, BCL_S1, intervalo_S2,
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
    if (t >= inicio_pulso && t < inicio_pulso + duração) {
      estimulo = amplitude;
      break;
    }
  }
  // Pulso S2
  const inicio_s2 = inicio + (num_estimulos_s1 - 1) * BCL_S1 + intervalo_S2;
  if (t >= inicio_s2 && t < inicio_s2 + duração) {
    estimulo = amplitude;
  }

  const v_prev = v[i - 1];
  const h_prev = h[i - 1];

  // Funções de derivada
  function f_v(vv, hh, t) {
    const J_entrada = (hh * vv ** 2 * (1 - vv)) / despolarização;
    const J_saida = -vv / repolarização;
    return J_entrada + J_saida + estimulo;
  }

  function f_h(vv, hh) {
    if (vv < gate) {
      return (1 - hh) / recuperação;
    } else {
      return -hh / inativação;
    }
  }

  // RK4
  //k1
  const k1_v = dt * f_v(v_prev, h_prev, t);
  const k1_h = dt * f_h(v_prev, h_prev);

  //k2
  const k2_v = dt * f_v(v_prev + 0.5 * k1_v, h_prev + 0.5 * k1_h, t + 0.5 * dt);
  const k2_h = dt * f_h(v_prev + 0.5 * k1_v, h_prev + 0.5 * k1_h);

  //k3
  const k3_v = dt * f_v(v_prev + 0.5 * k2_v, h_prev + 0.5 * k2_h, t + 0.5 * dt);
  const k3_h = dt * f_h(v_prev + 0.5 * k2_v, h_prev + 0.5 * k2_h);

  //k4
  const k4_v = dt * f_v(v_prev + k3_v, h_prev + k3_h, t + dt);
  const k4_h = dt * f_h(v_prev + k3_v, h_prev + k3_h);

  // Atualiza valores
  const v_next = v_prev + (1.0 / 6.0) * (k1_v + 2 * k2_v + 2 * k3_v + k4_v);
  const h_next = h_prev + (1.0 / 6.0) * (k1_h + 2 * k2_h + 2 * k3_h + k4_h);

  // Garante que v e h estejam no intervalo 0, 1
  v[i] = Math.max(0.0, Math.min(1.0, v_next));
  h[i] = Math.max(0.0, Math.min(1.0, h_next));
}

  // Potencial de ação do último S1 para calcular APD
  const inicio_ultimo_s1_idx = Math.round((inicio + (num_estimulos_s1 - 1) * BCL_S1) / dt);
  const v_s1 = v.slice(inicio_ultimo_s1_idx, inicio_ultimo_s1_idx + Math.round(BCL_S1 / dt));
  
  // Potencial de ação do S2 para calcular APD
  const inicio_s2_idx = Math.round((inicio + (num_estimulos_s1 - 1) * BCL_S1 + intervalo_S2) / dt);
  const v_s2 = v.slice(inicio_s2_idx, inicio_s2_idx + Math.round(BCL_S1 / dt));
  
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
  const allTimeSeriesData = [];
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
      const bcl = intervalo_S2;
      restitutionData.push({ bcl, apd: apd_s2 });
    }

    // Otimização do gráfico
    for (let i = 0; i < full_v.length; i += downsamplingFactor) {
        if(full_tempo[i] !== undefined) {
            allTimeSeriesData.push({ 
                tempo: (tempo_offset + full_tempo[i]).toFixed(2), 
                v: full_v[i], 
                h: full_h[i] 
            });
        }
    }
    if (full_tempo.length > 0) {
      tempo_offset += full_tempo[full_tempo.length - 1];
    }
  }

  // Ordena os dados da curva pelo BCL
  restitutionData.sort((a, b) => a.bcl - b.bcl);

  self.postMessage({ timeSeriesData: allTimeSeriesData, restitutionData });
};