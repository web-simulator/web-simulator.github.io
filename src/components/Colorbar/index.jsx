import React, { useEffect, useRef } from 'react';
import './styles.css';

const Colorbar = ({ maxValue = 1, minValue = 0 }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Limpa o canvas
    ctx.clearRect(0, 0, width, height);

    // Cria o gradiente de cores 
    const gradient = ctx.createLinearGradient(0, height, 0, 0); // de baixo para cima
    for (let i = 0; i <= 1; i += 0.1) {
      const hue = (1 - i) * 240; // Azul para 0, Vermelho para 1
      gradient.addColorStop(i, `hsl(${hue}, 100%, 50%)`);
    }

    // Desenha o gradiente
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

  }, [maxValue, minValue]);

  // Renderiza a barra de cores com os valores mínimo e máximo
  return ( 
    <div className="colorbar-container">
      <div className="colorbar-label">{maxValue.toFixed(1)}</div>
      <canvas ref={canvasRef} width="20" height="400" className="colorbar-canvas"></canvas>
      <div className="colorbar-label">{minValue.toFixed(1)}</div>
    </div>
  );
};

export default Colorbar;