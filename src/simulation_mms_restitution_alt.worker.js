function calculateAPD90(v, dt) {
  // Retorna 0 se o array de voltagem for inválido ou vazio
  if (!v || v.length === 0) {
    return 0;
  }
  // Encontra os valores máximo e mínimo do potencial de ação para calcular a amplitude
  const v_max = Math.max(...v);
  const v_min = Math.min(...v);
  const amplitude = v_max - v_min;
  // Se a amplitude for muito pequena, considera que não houve um potencial de ação válido
  if (amplitude < 0.2) {
    return 0;
  }
  // Calcula o valor da voltagem no ponto de 90% da repolarização
  const v_repol_90 = v_max - amplitude * 0.9;
  let despolarizacaoIdx = -1; // Índice do pico do potencial de ação
  let repolarizacaoIdx = -1; // Índice onde a repolarização atinge 90%
  
  // Encontra o índice do pico (considerado quando a voltagem atinge 98% do máximo)
  for (let i = 0; i < v.length; i++) {
    if (v[i] >= v_max * 0.98) {
      despolarizacaoIdx = i;
      break;
    }
  }
  // Se não encontrou um pico, retorna 0
  if (despolarizacaoIdx === -1) {
    return 0;
  }
  // A partir do pico, procura pelo índice onde a voltagem cai abaixo de 90% de repolarização
  for (let i = despolarizacaoIdx; i < v.length; i++) {
    if (v[i] <= v_repol_90) {
      repolarizacaoIdx = i;
      break;
    }
  }
  // Se não encontrou o ponto de repolarização, retorna 0
  if (repolarizacaoIdx === -1) {
    return 0;
  }
  // O APD é a diferença de tempo entre a repolarização e a despolarização
  return (repolarizacaoIdx - despolarizacaoIdx) * dt;
}

function runSingleCycle(params) {
  // Pega os parâmetros necessários para a simulação
  const {
    tau_in, tau_out, tau_open, tau_close, v_gate, dt,
    v_inicial, h_inicial, inicio, duracao, amplitude, BCL_S1, intervalo_S2,
    num_estimulos_s1
  } = params;

  // Parâmetros a e lambda do MMS
  const a = 0;
  const lambda = v_gate;

  // Calcula o tempo total necessário para este ciclo de simulação
  const tempo_total = inicio + (num_estimulos_s1 - 1) * BCL_S1 + intervalo_S2 + 1.5 * BCL_S1;
  const passos = parseInt(tempo_total / dt, 10);

  // Vetores para guardar os resultados
  const v = new Array(passos).fill(v_inicial); // Voltagem
  const h = new Array(passos).fill(h_inicial); // Gate 'h'
  const tempo = new Array(passos); // Tempo

  // Loop principal da simulação
  for (let i = 1; i < passos; i++) {
    tempo[i] = i * dt;
    const t = tempo[i];
    let estimulo = 0;

    // Pulsos S1
    for (let j = 0; j < num_estimulos_s1; j++) {
      const inicio_pulso = inicio + j * BCL_S1;
      if (t >= inicio_pulso && t < inicio_pulso + duracao) {
        estimulo = amplitude;
        break; // Sai do loop assim que o estímulo é aplicado para evitar sobreposições
      }
    }

    // Pulso S2
    const inicio_s2 = inicio + (num_estimulos_s1 - 1) * BCL_S1 + intervalo_S2;
    if (t >= inicio_s2 && t < inicio_s2 + duracao) {
      estimulo = amplitude;
    }

    // Pega os valores do passo anterior para o cálculo do passo atual
    const v_prev = v[i - 1];
    const h_prev = h[i - 1];

    // Euler para v
    const J_in = (h_prev * (v_prev + a) * (v_prev + a - lambda) * (1 - v_prev)) / tau_in;
    const J_out = -v_prev / tau_out;
    const dv_dt = J_in + J_out + estimulo;

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
    
    // Garante que V e h permaneçam entre 0 e 1
    v[i] = Math.max(0.0, Math.min(1.0, v_next));
    h[i] = Math.max(0.0, Math.min(1.0, h_next));
  }
  
  const inicio_ultimo_s1_idx = Math.round((inicio + (num_estimulos_s1 - 1) * BCL_S1) / dt); // Índice do início do último S1
  const inicio_s2_idx = Math.round((inicio + (num_estimulos_s1 - 1) * BCL_S1 + intervalo_S2) / dt); // Índice do início do S2
  const slice_duration_idx = Math.round(1.5 * BCL_S1 / dt); // Usa uma janela de 1.5x o BCL para garantir a captura do PA completo

  // Extrai os segmentos de voltagem do último S1 e do S2
  const v_s1 = v.slice(inicio_ultimo_s1_idx, inicio_ultimo_s1_idx + slice_duration_idx);
  const v_s2 = v.slice(inicio_s2_idx, inicio_s2_idx + slice_duration_idx);
  
  // Retorna os resultados do ciclo
  return { v_s1, v_s2, full_v: v, full_h: h, full_tempo: tempo };
}

// Web Worker para calcular a curva de restituição
self.onmessage = (e) => {
  const params = e.data;
  const {
    BCL_S2_inicial, BCL_S2_final, delta_CL, downsamplingFactor
  } = params;

  // Calcula quantos ciclos S1-S2 serão executados
  const num_ciclos = Math.floor((BCL_S2_inicial - BCL_S2_final) / delta_CL) + 1;
  const restitutionData = []; // Armazena os pontos (DI, APD)
  const allTimeSeriesData = []; // Armazena a série temporal completa
  let tempo_offset = 0;

  // Percorre cada ciclo S1-S2
  for (let ciclo = 0; ciclo < num_ciclos; ciclo++) {
    const intervalo_S2 = BCL_S2_inicial - (ciclo * delta_CL);
    if (intervalo_S2 < BCL_S2_final) continue; // Garante que o loop pare no limite final

    // Executa um ciclo S1-S2
    const cycleParams = { ...params, intervalo_S2 };
    const { v_s1, v_s2, full_v, full_h, full_tempo } = runSingleCycle(cycleParams);

    // Calcula o APD do último S1 e do S2
    const apd_s1 = calculateAPD90(v_s1, params.dt);
    const apd_s2 = calculateAPD90(v_s2, params.dt);

    // Se ambos os APDs forem válidos, calcula o Intervalo Diastólico e armazena
    if (apd_s1 > 0 && apd_s2 > 0) {
      const di = intervalo_S2 - apd_s1;
      if (di > 0) { // Garante que o DI seja positivo
        restitutionData.push({ bcl: di, apd: apd_s2 }); // 'bcl' é usado para o eixo X do gráfico 
      }
    }
    
    // Otimização do gráfico
    for (let i = 0; i < full_v.length; i += downsamplingFactor) {
      if (full_tempo[i] !== undefined) {
        allTimeSeriesData.push({
          tempo: (tempo_offset + full_tempo[i]).toFixed(2),
          v: full_v[i],
          h: full_h[i]
        });
      }
    }
    // Atualiza o Tempo para o próximo ciclo
    if (full_tempo.length > 0) {
      tempo_offset += full_tempo[full_tempo.length - 1];
    }
  }

  // Ordena os dados da curva pelo DI
  restitutionData.sort((a, b) => a.bcl - b.bcl);
  
  // Envia os dados da curva de restituição de volta para a página principal
  self.postMessage({ timeSeriesData: allTimeSeriesData, restitutionData });
};