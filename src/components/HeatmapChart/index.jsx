import React, { useEffect, useRef, memo, useState } from 'react';
import './styles.css';

const HeatmapChart = ({ data, maxValue = 1, onPointClick }) => {
  const canvasRef = useRef(null);
  
  // tootltip
  const [tooltip, setTooltip] = useState({
    visible: false, 
    y: 0,           
    value: 0,       
  });

  // Plota o gráfico de calor sempre que os dados ou o valor máximo mudam
  useEffect(() => {
    if (!data || data.length === 0 || !data[0] || data[0].length === 0) return;

    // Configura o gráfico
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Dimensões dos dados
    const nRows = data.length;
    const nCols = data[0].length;

    const offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = nCols;
    offscreenCanvas.height = nRows;
    const offscreenCtx = offscreenCanvas.getContext('2d');

    // Função que converte um valor numérico em uma cor 
    const getColor = (value) => {
      const normalizedValue = Math.max(0, Math.min(1, value / maxValue)); // Normaliza o valor entre 0 e 1
      const hue = (1 - normalizedValue) * 240; // 0 (vermelho) a 240 (azul)
      return `hsl(${hue}, 100%, 50%)`;
    };

    // Itera sobre cada ponto da matriz de dados
    for (let i = 0; i < nRows; i++) {
      for (let j = 0; j < nCols; j++) {
        // exibe o pixel com sua respectiva cor
        const value = data[i][j];
        offscreenCtx.fillStyle = getColor(value);
        offscreenCtx.fillRect(j, i, 1, 1);
      }
    }

    // Suavização da imagem
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(offscreenCanvas, 0, 0, width, height);
  }, [data, maxValue]);

  // Mostra o tooltip ao mover o mouse
  const handleMouseMove = (event) => {
    if (!data || data.length === 0 || !data[0] || data[0].length === 0) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left; // Posição X do mouse
    const y = event.clientY - rect.top; // Posição Y do mouse

    const nRows = data.length;
    const nCols = data[0].length;

    // Calcula em qual célula o mouse está
    const j = Math.floor(x / (canvas.width / nCols));
    const i = Math.floor(y / (canvas.height / nRows));

    // Atualiza o tooltip
    if (i >= 0 && i < nRows && j >= 0 && j < nCols) {
      const value = data[i][j];
      setTooltip({
        visible: true,
        x: event.clientX + 15, 
        y: event.clientY,
        value: value.toFixed(2), 
      });
    } else {
      // Mouse fora dos limites
      handleMouseLeave();
    }
  };

  // Esconde o tooltip
  const handleMouseLeave = () => {
    setTooltip({ ...tooltip, visible: false });
  };
  
  // Abre o modal ao clicar no gráfico
  const handleCanvasClick = (event) => {
    if (!data || data.length === 0 || !data[0] || data[0].length === 0 || !onPointClick) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const nRows = data.length;
    const nCols = data[0].length;

    // Calcula qual foi clicada
    const j = Math.floor(x / (canvas.width / nCols));
    const i = Math.floor(y / (canvas.height / nRows));

    if (i >= 0 && i < nRows && j >= 0 && j < nCols) {
      onPointClick({ i, j });
    }
  };

  // Mensagem enquanto aguarda os dados
  if (!data || data.length === 0) {
    return <p>Aguardando simulação...</p>;
  }

 // Estrutura do gráfico
  return (
    <div className="heatmap-container">
      <canvas
        ref={canvasRef}
        width="400"
        height="400"
        onMouseMove={handleMouseMove} // Tooltip
        onMouseLeave={handleMouseLeave} // Esconde o tooltip ao sair
        onClick={handleCanvasClick} // Ativa o clique
      ></canvas>

      {/* Mostra o tooltip*/}
      {tooltip.visible && (
        <div
          className="heatmap-tooltip"
          style={{ top: `${tooltip.y}px`, left: `${tooltip.x}px` }}
        >
          Valor: {tooltip.value}
        </div>
      )}
    </div>
  );
};

export default memo(HeatmapChart);