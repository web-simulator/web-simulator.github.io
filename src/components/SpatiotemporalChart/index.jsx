import React, { useEffect, useRef, memo } from 'react';

const SpatiotemporalChart = ({ simulationData, currentFrame }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!simulationData || simulationData.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Limpa o canvas
    ctx.clearRect(0, 0, width, height);

    const frameData = simulationData[currentFrame]?.data;
    if (!frameData) return;

    const numPoints = frameData.length;
    const cellWidth = width / numPoints;
    const cellHeight = height; // Altura é a altura total do canvas

    // Define uma função de mapeamento de cores (azul -> vermelho)
    const getColor = (value) => {
      const hue = (1 - value) * 240;
      return `hsl(${hue}, 100%, 50%)`;
    };

    // Desenha cada ponto de dados no canvas
    for (let x = 0; x < numPoints; x++) {
      const value = frameData[x].v;
      ctx.fillStyle = getColor(value);
      ctx.fillRect(x * cellWidth, 0, cellWidth, cellHeight);
    }

  }, [simulationData, currentFrame]);

  if (!simulationData || simulationData.length === 0) {
    return <p>Aguardando simulação...</p>;
  }

  return (
    <div style={{ padding: '20px', textAlign: 'center' }}>
      <h2>Visualização do estímulo</h2>
      <p>A cor muda de acordo com o potencial de ação (v).</p>
      <canvas ref={canvasRef} width="800" height="50" style={{ border: '1px solid #ccc' }}></canvas>
    </div>
  );
};

export default memo(SpatiotemporalChart);