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

  // Potencial de repolarização alvo 10% do pico ou 90% da queda
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

  // A partir do pico, encontra o índice onde a repolarização atinge 90%
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


// Função para executar um ciclo de simulação
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

  // Euler explícito
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

    // Despolarização e repolarização
    const J_entrada = (h[i - 1] * v[i - 1] ** 2 * (1 - v[i - 1])) / despolarização;
    const J_saida = -v[i - 1] / repolarização;

    // Variação do potencial
    const dv = J_entrada + J_saida + estimulo;

    let dh;
    if (v[i - 1] < gate) {
      dh = (1 - h[i - 1]) / recuperação; // Recuperação lenta
    } else {
      dh = -h[i - 1] / inativação; // Inativação rápida
    }

    // Atualiza v e h e garente que fiquem entre 0 e 1
    v[i] = Math.max(0.0, Math.min(1.0, v[i - 1] + dt * dv));
    h[i] = Math.max(0.0, Math.min(1.0, h[i - 1] + dt * dh));
  }

  // Potencial de ação do último S1 para calcular seu APD
  const inicio_ultimo_s1_idx = Math.round((inicio + (num_estimulos_s1 - 1) * BCL_S1) / dt);
  const v_s1 = v.slice(inicio_ultimo_s1_idx, inicio_ultimo_s1_idx + Math.round(BCL_S1 / dt));
  
  // Potencial de ação do S2 para calcular seu APD
  const inicio_s2_idx = Math.round((inicio + (num_estimulos_s1 - 1) * BCL_S1 + intervalo_S2) / dt);
  const v_s2 = v.slice(inicio_s2_idx, inicio_s2_idx + Math.round(BCL_S1 / dt));
  
  return { v_s1, v_s2, full_v: v, full_h: h, full_tempo: tempo };
}


self.onmessage = (e) => {
  const params = e.data;
  const {
    num_ciclos, intervalo_S2_inicial, decremento_S2, downsamplingFactor
  } = params;
  
  const restitutionData = [];
  const allTimeSeriesData = [];
  let tempo_offset = 0;

  // Construir a curva de restituição
  for (let ciclo = 0; ciclo < num_ciclos; ciclo++) {
    const intervalo_S2 = intervalo_S2_inicial - (ciclo * decremento_S2);
    if (intervalo_S2 <= 20) continue; // Evita intervalos muito curtos

    const cycleParams = { ...params, intervalo_S2 };
    const { v_s1, v_s2, full_v, full_h, full_tempo } = runSingleCycle(cycleParams);

    // Calcula APD90 do último S1 e do S2
    const apd_s1 = calculateAPD90(v_s1, params.dt);
    const apd_s2 = calculateAPD90(v_s2, params.dt);

    if (apd_s1 > 0 && apd_s2 > 0) {
      // DI: S1-S2 coupling interval - APD do último S1
      const di = intervalo_S2 - apd_s1;
      if (di > 0) {
          restitutionData.push({ di, apd: apd_s2 });
      }
    }
    
    // Pontos Gráfico principal
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

  // Ordena os dados da curva pelo DI
  restitutionData.sort((a, b) => a.di - b.di);

  self.postMessage({ timeSeriesData: allTimeSeriesData, restitutionData });
};