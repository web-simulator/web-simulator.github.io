self.onmessage = (e) => {
  const params = e.data;
  const {
    k,
    Tau_in, // Parâmetro renomeado
    Tau_out, // Parâmetro renomeado
    Tau_open, // Parâmetro renomeado
    Tau_close, // Parâmetro renomeado
    gate,
    L,
    dx,
    dt,
    totalTime,
    downsamplingFactor,
    inicio,
    duracao,
    amplitude,
  } = params;

  const N = Math.floor(L / dx);

  let v = new Array(N).fill(0);
  let h = new Array(N).fill(1);
  
  // Condição inicial: estímulo na borda esquerda
  const initial_width = Math.floor(N / 10);
  for (let i = 0; i < initial_width; i++) {
    v[i] = 1.05;
  }
  
  const steps = Math.floor(totalTime / dt);
  const outputData = [];

  // Funções de derivada para o método RK4
  function f_v(vv, hh, i) {
    const diffusion = k * (vv[i + 1] - 2 * vv[i] + vv[i - 1]) / (dx * dx);
    // Usando os novos parâmetros
    const J_entrada = (hh[i] * vv[i] ** 2 * (1 - vv[i])) / Tau_in;
    const J_saida = -vv[i] / Tau_out;
    return diffusion + J_entrada + J_saida;
  }

  function f_h(vv, hh, i) {
    if (vv[i] < gate) {
      return (1 - hh[i]) / Tau_open;
    } else {
      return -hh[i] / Tau_close;
    }
  }

  for (let t = 0; t < steps; t++) {
    const v_prev = [...v];
    const h_prev = [...h];
    
    const k1_v = new Array(N).fill(0);
    const k1_h = new Array(N).fill(0);
    const k2_v = new Array(N).fill(0);
    const k2_h = new Array(N).fill(0);
    const k3_v = new Array(N).fill(0);
    const k3_h = new Array(N).fill(0);
    const k4_v = new Array(N).fill(0);
    const k4_h = new Array(N).fill(0);

    // K1
    for (let i = 1; i < N - 1; i++) {
      k1_v[i] = dt * f_v(v_prev, h_prev, i);
      k1_h[i] = dt * f_h(v_prev, h_prev, i);
    }

    // K2
    const v_k2 = [...v_prev];
    const h_k2 = [...h_prev];
    for (let i = 1; i < N - 1; i++) {
      v_k2[i] = v_prev[i] + 0.5 * k1_v[i];
      h_k2[i] = h_prev[i] + 0.5 * k1_h[i];
    }
    v_k2[0] = v_k2[1];
    v_k2[N - 1] = v_k2[N - 2];
    h_k2[0] = h_k2[1];
    h_k2[N - 1] = h_k2[N - 2];
    for (let i = 1; i < N - 1; i++) {
      k2_v[i] = dt * f_v(v_k2, h_k2, i);
      k2_h[i] = dt * f_h(v_k2, h_k2, i);
    }

    // K3
    const v_k3 = [...v_prev];
    const h_k3 = [...h_prev];
    for (let i = 1; i < N - 1; i++) {
      v_k3[i] = v_prev[i] + 0.5 * k2_v[i];
      h_k3[i] = h_prev[i] + 0.5 * k2_h[i];
    }
    v_k3[0] = v_k3[1];
    v_k3[N - 1] = v_k3[N - 2];
    h_k3[0] = h_k3[1];
    h_k3[N - 1] = h_k3[N - 2];
    for (let i = 1; i < N - 1; i++) {
      k3_v[i] = dt * f_v(v_k3, h_k3, i);
      k3_h[i] = dt * f_h(v_k3, h_k3, i);
    }

    // K4
    const v_k4 = [...v_prev];
    const h_k4 = [...h_prev];
    for (let i = 1; i < N - 1; i++) {
      v_k4[i] = v_prev[i] + k3_v[i];
      h_k4[i] = h_prev[i] + k3_h[i];
    }
    v_k4[0] = v_k4[1];
    v_k4[N - 1] = v_k4[N - 2];
    h_k4[0] = h_k4[1];
    h_k4[N - 1] = h_k4[N - 2];
    for (let i = 1; i < N - 1; i++) {
      k4_v[i] = dt * f_v(v_k4, h_k4, i);
      k4_h[i] = dt * f_h(v_k4, h_k4, i);
    }

    for (let i = 1; i < N - 1; i++) {
      v[i] = v_prev[i] + (1.0 / 6.0) * (k1_v[i] + 2 * k2_v[i] + 2 * k3_v[i] + k4_v[i]);
      h[i] = h_prev[i] + (1.0 / 6.0) * (k1_h[i] + 2 * k2_h[i] + 2 * k3_h[i] + k4_h[i]);
      v[i] = Math.max(0.0, Math.min(1.0, v[i]));
      h[i] = Math.max(0.0, Math.min(1.0, h[i]));
    }
    
    v[0] = v[1];
    v[N - 1] = v[N - 2];
    h[0] = h[1];
    h[N - 1] = h[N - 2];

    if (t % downsamplingFactor === 0) {
      const snapshot = v.map((v_val, index) => ({
        x: index * dx,
        v: v_val,
        h: h[index],
        tempo: (t * dt).toFixed(2)
      }));
      outputData.push({
        time: (t * dt).toFixed(2),
        data: snapshot
      });
    }
  }

  self.postMessage(outputData);
};