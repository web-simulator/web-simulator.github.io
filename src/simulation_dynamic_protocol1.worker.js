function calculateAPD90(v, dt) {
  // Retorna 0 se o array de voltagem for inválido ou vazio
  if (!v || v.length === 0) return 0;

  // Encontra os valores máximo e mínimo do potencial de ação para calcular a amplitude
  const v_max = Math.max(...v);
  const v_min = Math.min(...v);
  const amplitude = v_max - v_min;

  // Se a amplitude for muito pequena, considera que não houve um potencial de ação válido
  if (amplitude < 0.2) return 0;

  // Calcula o valor da voltagem no ponto de 90% da repolarização
  const v_repol_90 = v_max - amplitude * 0.9;
  let despolarizacaoIdx = -1; // Índice do pico do potencial de ação
  let repolarizacaoIdx = -1; // Índice onde a repolarização atinge 90%

  // Encontra o índice do pico considerado quando a voltagem atinge 98% do máximo
  for (let i = 0; i < v.length; i++) {
    if (v[i] >= v_max * 0.98) {
      despolarizacaoIdx = i;
      break;
    }
  }

  // Se não encontrou um pico, retorna 0.
  if (despolarizacaoIdx === -1) return 0;

  // A partir do pico, procura pelo índice onde a voltagem cai abaixo do limiar de 90% de repolarização
  for (let i = despolarizacaoIdx; i < v.length; i++) {
    if (v[i] <= v_repol_90) {
      repolarizacaoIdx = i;
      break;
    }
  }

  // Se não encontrou o ponto de repolarização (o potencial de ação é mais longo que a janela de medição), retorna 0.
  if (repolarizacaoIdx === -1) return 0;

  // O APD é a diferença de tempo entre a repolarização e a despolarização
  return (repolarizacaoIdx - despolarizacaoIdx) * dt;
}

// Executada quando o worker recebe uma mensagem
self.onmessage = (e) => {
  // Extrai todos os parâmetros
  const params = e.data;
  const {
    tau_in, tau_out, tau_open, tau_close, v_gate, dt,
    v_inicial, h_inicial, inicio, duracao, amplitude,
    CI1, CI0, CIinc, nbeats, downsamplingFactor
  } = params;

  const num_cis = Math.floor((CI1 - CI0) / CIinc) + 1; // Calcula o número de CIs que serão simulados.
  
  const tempo_total_estimado = inicio + num_cis * nbeats * CI1; // Estima o tempo total da simulação para alocar memória suficiente nos arrays
  const passos = parseInt(tempo_total_estimado / dt, 10);

  // Vetores para guardar os resukltados
  const v = new Array(passos).fill(v_inicial); // Voltagem
  const h = new Array(passos).fill(h_inicial); // Gate 'h'
  const tempo = new Array(passos).fill(0);    // Tempo

  const restitutionData = []; // Pontos da curva de restituição
  let passo_atual = 1; // Contador 
  let tempo_atual_estimulo = inicio; // Controla o momento de aplicar o próximo estímulo

  // Itera sobre cada valor de CI, do maior (CI1) para o menor (CI0).
  for (let CI = CI1; CI >= CI0; CI -= CIinc) {
    // Loop secundário: Para cada CI, aplica 'nbeats' estímulos para que a célula se adapte a esse ritmo
    for (let beat = 0; beat < nbeats; beat++) {
      // Define as variáveis de tempo para o batimento atual
      const inicio_pulso = tempo_atual_estimulo;
      const fim_pulso = inicio_pulso + duracao;
      const fim_ciclo = inicio_pulso + CI;
      const passo_inicio_pulso = Math.round(inicio_pulso / dt);

      //  Avança no tempo (passo a passo) até o final do ciclo atual
      while (passo_atual * dt < fim_ciclo && passo_atual < passos) {
        tempo[passo_atual] = passo_atual * dt;
        const t = tempo[passo_atual];
        
        // Verifica se o tempo está dentro da janela de aplicação do estímulo
        const estimulo = (t >= inicio_pulso && t < fim_pulso) ? amplitude : 0;
        
        // Pega os valores do passo anterior para usar nos cálculos do passo atual
        const v_prev = v[passo_atual - 1];
        const h_prev = h[passo_atual - 1];

        // Define as funções que representam as equações diferenciais do modelo
        const f_v = (vv, hh) => { // Derivada da voltagem 
          const J_entrada = (hh * vv ** 2 * (1 - vv)) / tau_in;
          const J_saida = -vv / tau_out;
          return J_entrada + J_saida + estimulo;
        };
        const f_h = (vv, hh) => { // Derivada da variável de gate 
          if (vv < v_gate) {
            return (1 - hh) / tau_open;
          } else {
            return -hh / tau_close;
          }
        };

        // k1
        const k1_v = dt * f_v(v_prev, h_prev);
        const k1_h = dt * f_h(v_prev, h_prev);

        // k2
        const k2_v = dt * f_v(v_prev + 0.5 * k1_v, h_prev + 0.5 * k1_h);
        const k2_h = dt * f_h(v_prev + 0.5 * k1_v, h_prev + 0.5 * k1_h);

        // k3
        const k3_v = dt * f_v(v_prev + 0.5 * k2_v, h_prev + 0.5 * k2_h);
        const k3_h = dt * f_h(v_prev + 0.5 * k2_v, h_prev + 0.5 * k2_h);

        // k4
        const k4_v = dt * f_v(v_prev + k3_v, h_prev + k3_h);
        const k4_h = dt * f_h(v_prev + k3_v, h_prev + k3_h);
        
        // Próximo valor
        const v_next = v_prev + (1.0 / 6.0) * (k1_v + 2 * k2_v + 2 * k3_v + k4_v);
        const h_next = h_prev + (1.0 / 6.0) * (k1_h + 2 * k2_h + 2 * k3_h + k4_h);

        // Garante que V e h permaneçam entre 0 e 1
        v[passo_atual] = Math.max(0.0, Math.min(1.0, v_next));
        h[passo_atual] = Math.max(0.0, Math.min(1.0, h_next));
        
        passo_atual++; // Avança para o próximo passo de tempo
      }
      
      // Apenas no último batimento de um CI, calcula o APD para gerar a curva de restituição
      if (beat === nbeats - 1) {
        // Cria uma "janela de medição" longa o suficiente (2x o CI) para garantir que o PA inteiro seja capturado
        const janela_medicao_passos = Math.round(2 * CI / dt); 
        const v_pulso = v.slice(passo_inicio_pulso, passo_inicio_pulso + janela_medicao_passos);
        const apd = calculateAPD90(v_pulso, dt);
        
        // Se um APD válido foi calculado, adiciona o ponto aos dados da curva
        if (apd > 0) {
          restitutionData.push({ bcl: CI, apd });
        }
      }
      
      // Atualiza o tempo do próximo estímulo para o início do próximo ciclo
      tempo_atual_estimulo += CI;
    }
  }

  const timeSeriesData = [];
  // Reduz a quantidade de pontos no gráfico para otimização
  for (let i = 0; i < passo_atual; i += downsamplingFactor) {
    if (tempo[i] !== undefined) {
      timeSeriesData.push({
        tempo: tempo[i].toFixed(2),
        v: v[i],
        h: h[i]
      });
    }
  }
  
  // Ordena os dados da curva de restituição pelo BCL
  restitutionData.sort((a, b) => a.bcl - b.bcl);
  
  // Envia os resultados para a página principal.
  self.postMessage({ timeSeriesData, restitutionData });
};