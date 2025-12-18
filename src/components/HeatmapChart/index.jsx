import React, { useEffect, useRef, memo, useState, useMemo } from 'react';
import './styles.css';

// Converte HSL para RGB
const hslToRgb = (h, s, l) => {
  s /= 100; l /= 100;
  const k = n => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
};

const HeatmapChart = ({ data, nCols, maxValue = 1, onPointClick, fibrosisMap, fibrosisConductivity }) => {
  const canvasRef = useRef(null);
  
  // tooltip
  const [tooltip, setTooltip] = useState({
    visible: false, 
    y: 0,           
    value: 0,       
  });

  //Pré-calcula a tabela de cores para evitar contas repetidas no loop
  const colorMap = useMemo(() => {
    const map = new Uint8ClampedArray(256 * 3);
    for (let i = 0; i < 256; i++) {
      const normalizedValue = i / 255;
      const hue = (1 - normalizedValue) * 240; 
      const [r, g, b] = hslToRgb(hue, 100, 50);
      map[i * 3] = r;
      map[i * 3 + 1] = g;
      map[i * 3 + 2] = b;
    }
    return map;
  }, []);

  // Plota o gráfico sempre que os dados ou o valor máximo mudam
  useEffect(() => {
    if (!data || data.length === 0 || !nCols) return;

    // Configura o gráfico
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    
    // Dimensões dos dados
    const nRows = Math.ceil(data.length / nCols);
    
    // Ajusta o tamanho interno do canvas para bater com os dados
    if (canvas.width !== nCols || canvas.height !== nRows) {
        canvas.width = nCols;
        canvas.height = nRows;
    }

    const imageData = ctx.createImageData(nCols, nRows);
    const pixels = imageData.data;

    // Loop linear
    for (let i = 0; i < data.length; i++) {
        const idx = i * 4; // Índice do pixel RGBA

        // Verifica se o ponto faz parte da fibrose
        const isFibrosisRegion = fibrosisMap && Math.abs(fibrosisMap[i] - fibrosisConductivity) < 1e-9;
        
        // Só pinta de preto se for fibrose e a condutividade for zero
        if (isFibrosisRegion && fibrosisConductivity < 1e-9) {
            pixels[idx] = 0;     // R
            pixels[idx + 1] = 0; // G
            pixels[idx + 2] = 0; // B
            pixels[idx + 3] = 255; // Alpha
        } else {
            const val = data[i];
            const safeVal = Math.max(0, Math.min(maxValue, val));
            const colorIndex = Math.floor((safeVal / maxValue) * 255);
            
            pixels[idx] = colorMap[colorIndex * 3];     
            pixels[idx + 1] = colorMap[colorIndex * 3 + 1]; 
            pixels[idx + 2] = colorMap[colorIndex * 3 + 2]; 
            pixels[idx + 3] = 255; 
        }
    }

    ctx.putImageData(imageData, 0, 0);

  }, [data, nCols, maxValue, fibrosisMap, fibrosisConductivity, colorMap]);

  // Mostra o tooltip ao mover o mouse
  const handleMouseMove = (event) => {
    if (!data || data.length === 0 || !nCols) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    // Ajusta coordenadas do mouse para o tamanho real do grafico
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = (event.clientX - rect.left) * scaleX; 
    const y = (event.clientY - rect.top) * scaleY; 

    // Calcula em qual célula o mouse está
    const j = Math.floor(x);
    const i = Math.floor(y);
    const index = i * nCols + j;

    if (index >= 0 && index < data.length) {
      const value = data[index];
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
    if (!data || !onPointClick || !nCols) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;

    // Calcula qual foi clicada
    const j = Math.floor(x);
    const i = Math.floor(y);
    const index = i * nCols + j;

    if (index >= 0 && index < data.length) {
      onPointClick({ i, j });
    }
  };

 // Estrutura do gráfico
  return (
    <div className="heatmap-container" style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden',  }}>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', imageRendering: 'auto', display: 'block' }} 
        onMouseMove={handleMouseMove} 
        onMouseLeave={handleMouseLeave} 
        onClick={handleCanvasClick} 
      ></canvas>

      {/* Mostra o tooltip*/}
      {tooltip.visible && (
        <div className="heatmap-tooltip" style={{ top: `${tooltip.y}px`, left: `${tooltip.x}px` }}>
          Valor: {tooltip.value}
        </div>
      )}
    </div>
  );
};

export default memo(HeatmapChart);