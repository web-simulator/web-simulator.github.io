import React, { useEffect, useRef, memo, useState } from 'react';
import './styles.css';

const HeatmapChart = ({ data, maxValue = 1 }) => {
  const canvasRef = useRef(null);
  const [tooltip, setTooltip] = useState({ // Mostra o valor ao passar o mouse
    visible: false,
    x: 0,
    y: 0,
    value: 0,
  });

  useEffect(() => { // Desenha o heatmap
    if (!data || data.length === 0) return; // Verifica se há dados
    const canvas = canvasRef.current; 
    const ctx = canvas.getContext('2d');
    const width = canvas.width; // Largura
    const height = canvas.height; // Altura
    ctx.clearRect(0, 0, width, height);
    const N = data.length;
    const cellWidth = width / N; // Largura de cada célula
    const cellHeight = height / N; // Altura de cada célula
    const getColor = (value) => { 
      const normalizedValue = Math.max(0, Math.min(1, value / maxValue)); // Normaliza entre 0 e 1
      const hue = (1 - normalizedValue) * 240; // Azul (240) para Vermelho (0)
      return `hsl(${hue}, 100%, 50%)`; // Converte para cor HSL
    };
    for (let i = 0; i < N; i++) { // Percorre as linhas
      for (let j = 0; j < N; j++) { // Percorre as colunas
        const value = data[i][j]; // Valor da célula
        ctx.fillStyle = getColor(value); // Define a cor
        ctx.fillRect(j * cellWidth, i * cellHeight, cellWidth, cellHeight); // Desenha a célula
      }
    }
  }, [data, maxValue]);

  const handleMouseMove = (event) => { // Mostra o valor ao passar o mouse
    if (!data || data.length === 0) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect(); 
    const x = event.clientX - rect.left; // Coordenada X relativa ao canvas
    const y = event.clientY - rect.top; // Coordenada Y relativa ao canvas

    const N = data.length;
    const cellWidth = canvas.width / N;
    const cellHeight = canvas.height / N;

    const j = Math.floor(x / cellWidth);  // Índice da coluna
    const i = Math.floor(y / cellHeight); // Índice da linha

    if (i >= 0 && i < N && j >= 0 && j < N) {
      const value = data[i][j];
      setTooltip({
        visible: true,
        x: event.clientX + 15, // Posição X do tooltip 
        y: event.clientY,      // Posição Y do tooltip
        value: value.toFixed(2), // Formata o valor com 2 casas decimais
      });
    } else {
      handleMouseLeave();
    }
  };

  const handleMouseLeave = () => { // Esconde o tooltip quando o mouse sai do canvas
    setTooltip({ ...tooltip, visible: false }); 
  };

  if (!data || data.length === 0) { // Mensagem antes da simulação
    return <p>Aguardando simulação...</p>;
  }

  // Renderiza o heatmap e o tooltip
  return ( 
    <div className="heatmap-container">
      <canvas
        ref={canvasRef}
        width="400"
        height="400"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      ></canvas>
      {tooltip.visible && (
        <div
          className="heatmap-tooltip"
          style={{
            top: `${tooltip.y}px`,
            left: `${tooltip.x}px`,
          }}
        >
          Valor: {tooltip.value}
        </div>
      )}
    </div>
  );
};

export default memo(HeatmapChart);