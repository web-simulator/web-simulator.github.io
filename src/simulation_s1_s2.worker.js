// Função para aplicar estímulos S1-S2
function aplicarEstimulo(tempo_atual, amplitude, duracao, inicio, BCL_S1, intervalo_S2, num_estimulos_s1) {
  // Aplica os 8 estímulos S1
  for (let i = 0; i < num_estimulos_s1; i++) {
    const inicio_pulso = inicio + i * BCL_S1;
    if (tempo_atual >= inicio_pulso && tempo_atual < inicio_pulso + duracao) {
      return amplitude;
    }
  }

  // Aplica o estímulo S2
  const inicio_s2 = inicio + (num_estimulos_s1 - 1) * BCL_S1 + intervalo_S2;
  if (tempo_atual >= inicio_s2 && tempo_atual < inicio_s2 + duracao) {
    return amplitude;
  }

  return 0.0;
}

// Parâmetros da simulação para o worker
self.onmessage = (e) => {
  const params = e.data;
  const {
    despolarização,
    repolarização,
    recuperação,
    inativação,
    gate,
    dt,
    v_inicial,
    h_inicial,
    inicio,
    duração,
    amplitude,
    BCL_S1,
    intervalo_S2,
    num_estimulos_s1,
    downsamplingFactor,
  } = params;

  // Tempo total da simulação
  const tempo_total = inicio + (num_estimulos_s1 - 1) * BCL_S1 + intervalo_S2 + 2 * BCL_S1;
  // Número total de passos
  const passos = parseInt(tempo_total / dt, 10);

  const tempo = new Array(passos); // tempo
  const v = new Array(passos); // voltagem
  const h = new Array(passos); // gate

  // Condições iniciais
  v[0] = v_inicial;
  h[0] = h_inicial;
  tempo[0] = 0;

  // Euler explícito
  for (let i = 1; i < passos; i++) {
    tempo[i] = i * dt;
    const t = tempo[i];

    // Determina se há estímulo aplicado neste instante
    const estimulo = aplicarEstimulo(t, amplitude, duração, inicio, BCL_S1, intervalo_S2, num_estimulos_s1);

    // Despolarização e repolarização
    const J_entrada = (h[i - 1] * v[i - 1] ** 2 * (1 - v[i - 1])) / despolarização;
    const J_saida = -v[i - 1] / repolarização;

    // Variação do potencial
    const dv = J_entrada + J_saida + estimulo;

    // Variação da variável gate
    let dh;
    if (v[i - 1] < gate) {
      dh = (1 - h[i - 1]) / recuperação; // Recuperação lenta
    } else {
      dh = -h[i - 1] / inativação; // Inativação rápida
    }
    
    // Atualiza as variáveis e mantém no intervalo 0,1
    v[i] = Math.max(0.0, Math.min(1.0, v[i - 1] + dt * dv));
    h[i] = Math.max(0.0, Math.min(1.0, h[i - 1] + dt * dh));
  }

  // Reduz a quantidade de pontos para otimização
  const sampledData = [];
  for (let i = 0; i < passos; i += downsamplingFactor) {
    sampledData.push({ tempo: tempo[i]?.toFixed(2), v: v[i], h: h[i] });
  }

  // Envia os dados para a página principal
  self.postMessage(sampledData);
};