// Parâmetros da simulação para o worker
self.onmessage = (e) => {
  const params = e.data;
  const {
    despolarização,       // Ativação do potencial
    repolarização,        // Tepolarização
    recuperação,          // Tempo de recuperação 
    inativação,           // Tempo de inativação 
    gate,                 // Limite para ativar ou inativar
    dt,                   // Passo de tempo da simulação
    tempo_total,          // Duração total
    v_inicial,            // Condição inicial para v 
    h_inicial,            // Condição inicial para h 
    inicio,               // Tempo de início do estímulo
    duração,              // Duração do estímulo
    amplitude,            // Amplitude do estímulo
    downsamplingFactor,   // Fator para reduzir a quantidade de pontos enviados ao gráfico
  } = params;

  // Número total de passos
  const passos = parseInt(tempo_total / dt, 10);

  const tempo = new Array(passos); // tempo
  const v = new Array(passos); // voltagem
  const h = new Array(passos); //gate

  // Condições iniciais
  v[0] = v_inicial;
  h[0] = h_inicial;
  tempo[0] = 0;

  // RK4
  for (let i = 1; i < passos; i++) {
    tempo[i] = i * dt; // Tempo atual
    const t = tempo[i];

    // Determina se há estímulo aplicado neste instante
    let estimulo = 0;
    if (t >= inicio && t < inicio + duração) {
      estimulo = amplitude;
    }

    const v_prev = v[i - 1];
    const h_prev = h[i - 1];

    // Funções de derivada
    const f_v = (vv, hh) => {
      const J_entrada = (hh * vv ** 2 * (1 - vv)) / despolarização;
      const J_saida = -vv / repolarização;
      return J_entrada + J_saida + estimulo; // estimulo é constante para este passo dt
    };

    const f_h = (vv, hh) => {
      if (vv < gate) {
        return (1 - hh) / recuperação;  // Recuperação lenta
      } else {
        return -hh / inativação;        // Inativação rápida
      }
    };

    // K1
    const k1_v = dt * f_v(v_prev, h_prev);
    const k1_h = dt * f_h(v_prev, h_prev);

    // K2
    const k2_v = dt * f_v(v_prev + 0.5 * k1_v, h_prev + 0.5 * k1_h);
    const k2_h = dt * f_h(v_prev + 0.5 * k1_v, h_prev + 0.5 * k1_h);

    // K3
    const k3_v = dt * f_v(v_prev + 0.5 * k2_v, h_prev + 0.5 * k2_h);
    const k3_h = dt * f_h(v_prev + 0.5 * k2_v, h_prev + 0.5 * k2_h);

    // K4
    const k4_v = dt * f_v(v_prev + k3_v, h_prev + k3_h);
    const k4_h = dt * f_h(v_prev + k3_v, h_prev + k3_h);

    // Próximo valor
    const v_next = v_prev + (1.0 / 6.0) * (k1_v + 2 * k2_v + 2 * k3_v + k4_v);
    const h_next = h_prev + (1.0 / 6.0) * (k1_h + 2 * k2_h + 2 * k3_h + k4_h);

    // Atualiza v e h 
    v[i] = Math.max(0.0, Math.min(1.0, v_next));
    h[i] = Math.max(0.0, Math.min(1.0, h_next));
  }

  // Reduz a quantidade de pontos para otimização
  const sampledData = [];
  for (let i = 0; i < passos; i += downsamplingFactor) {
    sampledData.push({ tempo: tempo[i].toFixed(2), v: v[i], h: h[i] });
  }

  // Envia os dados para a página principal
  self.postMessage(sampledData);
};