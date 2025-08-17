
function estimulo_periodico(tempo_atual, amplitude, duracao, inicio, BCL, num_estimulos) {
  for (let i = 0; i < num_estimulos; i++) {
    const inicio_pulso = inicio + i * BCL; // Calcula o início de cada pulso
    // Se o tempo atual estiver dentro da janela de um pulso, retorna a amplitude
    if (tempo_atual >= inicio_pulso && tempo_atual < inicio_pulso + duracao) {
      return amplitude;
    }
  }
  return 0.0; // Retorna 0 se não houver estímulo no tempo atual
}

// Handler principal que executa a simulação
self.onmessage = (e) => {
  const params = e.data;
  const {
    despolarização, repolarização, recuperação, inativação, gate, dt,
    v_inicial, h_inicial, inicio, duração, amplitude, BCL,
    num_estimulos, downsamplingFactor,
  } = params;

  // Calcula o tempo total e o número de passos da simulação
  const tempo_total = inicio + num_estimulos * BCL + 50;
  const passos = parseInt(tempo_total / dt, 10);

  // Inicializa os arrays de resultados
  const tempo = new Array(passos);
  const v = new Array(passos);
  const h = new Array(passos);

  // Define as condições iniciais
  v[0] = v_inicial;
  h[0] = h_inicial;
  tempo[0] = 0;

  // Loop principal da simulação
  for (let i = 1; i < passos; i++) {
    tempo[i] = i * dt;
    const t = tempo[i];

    // Verifica se há estímulo a ser aplicado neste passo de tempo
    const estimulo = estimulo_periodico(t, amplitude, duração, inicio, BCL, num_estimulos);
    
    // Pega os valores do passo anterior.
    const v_prev = v[i - 1];
    const h_prev = h[i - 1];
    
    const f_v = (vv, hh) => { // Derivada da voltagem
      const J_entrada = (hh * vv ** 2 * (1 - vv)) / despolarização;
      const J_saida = -vv / repolarização;
      return J_entrada + J_saida + estimulo;
    };
    const f_h = (vv, hh) => { // Derivada da variável de gate
      if (vv < gate) {
        return (1 - hh) / recuperação;
      } else {
        return -hh / inativação;
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
    
    // Cálculo do próximo passo
    const v_next = v_prev + (1.0 / 6.0) * (k1_v + 2 * k2_v + 2 * k3_v + k4_v);
    const h_next = h_prev + (1.0 / 6.0) * (k1_h + 2 * k2_h + 2 * k3_h + k4_h);

    // Atualiza os arrays de resultado, garantindo que os valores fiquem entre 0 e 1
    v[i] = Math.max(0.0, Math.min(1.0, v_next));
    h[i] = Math.max(0.0, Math.min(1.0, h_next));
  }

  // Reduz a quantidade de pontos para otimizar a renderização do gráfico
  const sampledData = [];
  for (let i = 0; i < passos; i += downsamplingFactor) {
    if (tempo[i] !== undefined) {
      sampledData.push({ tempo: tempo[i].toFixed(2), v: v[i], h: h[i] });
    }
  }

  // Envia os dados processados de volta para a página principal
  self.postMessage(sampledData);
};