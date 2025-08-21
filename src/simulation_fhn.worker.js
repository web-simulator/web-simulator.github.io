
self.onmessage = (e) => {
  // parâmetros inseridos
  const params = e.data;
  const {
    // Parâmetros do modelo
    k,           
    A,           
    alpha,       
    epsilon,     
    gamma,       

    // Parâmetros da Simulação 
    L,           
    dx,          
    dt,          
    totalTime,   
    downsamplingFactor, 

    // Decide qual modelo usar
    initialCondition // pulso na borda ou reentrada
  } = params;

  const N = Math.floor(L / dx); // Calcula o número de pontos

  let v = new Array(N).fill(0); // Vetor de ativação

  let w = new Array(N).fill(0); // Vetor de recuperação/inibição

  // Seleciona e aplica a condição inicial com base no parâmetro recebido
  if (initialCondition === 'reentry') {
    // Condição reentrada simula um estímulo central com um bloqueio refratário lateral.
    const mid = Math.floor(N / 2); // Encontra o índice do ponto central.

    // Aplica um estímulo inicial em uma pequena região no centro
    for (let i = mid - 2; i < mid + 2; i++) {
        v[i] = 1.05; // Valor acima do limiar para iniciar a ativação
    }
    
    // Cria um bloco refratário a esquerda. Impede que a onda se propague a esquerda
    for (let i = 0; i < Math.floor(0.9 * mid); i++) {
        w[i] = 1.0;
    }
  } else { // left_pulse'
    // Cria um pulso de ativação no início 
    const initial_width = Math.floor(N / 10); // Define a largura do pulso inicial
    for(let i = 0; i < initial_width; i++) {
        v[i] = 1.05; // Ativa os primeiros pontos
    }
  }

  // Calcula o número total de passos de tempo
  const steps = Math.floor(totalTime / dt);
  const outputData = []; // resultados da simulação

  // Loop principal da simulação
  for (let t = 0; t < steps; t++) {
    // Valores do passo anterior
    const v_prev = [...v];
    const w_prev = [...w];

    // Itera sobre cada ponto interno (euler)
    for (let i = 1; i < N - 1; i++) {
      const diffusion = k * (v_prev[i + 1] - 2 * v_prev[i] + v_prev[i - 1]) / (dx * dx); // calcula o termo de difusão

      const reaction_v = A * v_prev[i] * (1 - v_prev[i]) * (v_prev[i] - alpha); // termo de reação

      v[i] = v_prev[i] + dt * (diffusion + reaction_v - w_prev[i]); // atualiza v

      const reaction_w = epsilon * (v_prev[i] - gamma * w_prev[i]); // reação

      w[i] = w_prev[i] + dt * reaction_w; // atualiza w
    }

    // Condições de Neumann
    v[0] = v[1];
    v[N - 1] = v[N - 2];
    w[0] = w[1];
    w[N - 1] = w[N - 2];

    // Verifica se o passo de tempo atual deve ser salvo 
    if (t % downsamplingFactor === 0) {
      const snapshot = v.map((v_val, index) => ({
        x: index * dx, // Posição no espaço
        v: v_val,      // Valor de v
        w: w[index],   // Valor de w
        tempo: (t * dt).toFixed(2) // Tempo atual
      }));
      // Adiciona o snapshot aos dados de saída.
      outputData.push({
        time: (t * dt).toFixed(2),
        data: snapshot
      });
    }
  }

  // Retorna os dados da simulação
  self.postMessage(outputData);
};