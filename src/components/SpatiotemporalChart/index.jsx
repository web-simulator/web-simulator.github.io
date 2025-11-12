import React, { useEffect, useRef, memo } from 'react';

// Gráfico de cores 
const SpatiotemporalChart = ({ simulationData, currentFrame, onPointClick }) => {
  const canvasRef = useRef(null);

  // Desenha o gráfico
  useEffect(() => {
    // Se não houver dados interrompe a execução
    if (!simulationData || simulationData.length === 0) return;

    const canvas = canvasRef.current;

    canvas.width = canvas.clientWidth;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Limpa a tela antes de atualizar
    ctx.clearRect(0, 0, width, height);

    // Pega os dados do quadro atual
    const frameData = simulationData[currentFrame]?.data;
    if (!frameData) return;

    const numPoints = frameData.length;
    const cellWidth = width / numPoints; 
    const cellHeight = height;

    // O valor v varia de 0 a 1
    const getColor = (value) => {
      // Normaliza o valor para garantir que esteja entre 0 e 1
      const normalizedValue = Math.max(0, Math.min(1, value || 0)); 
      const hue = (1 - normalizedValue) * 240; // 240 é azul, 0 é vermelho
      return `hsl(${hue}, 100%, 50%)`;
    };

    // Percorre todos os pontos e desenha um retângulo para cada um
    for (let x = 0; x < numPoints; x++) {
      const value = frameData[x].v;
      ctx.fillStyle = getColor(value);
      ctx.fillRect(x * cellWidth, 0, Math.ceil(cellWidth), cellHeight); 
    }
  }, [simulationData, currentFrame]); // Re-executa quando os dados mudam

  useEffect(() => {
    const canvas = canvasRef.current;
    // Caso algum dos elementos necessários não exista interrompe
    if (!canvas || !onPointClick || !simulationData[0]?.data) return;

    // Lida com o clique no gráfico
    const handleCanvasClick = (event) => {
      // Pega a posição do clique 
      const rect = canvas.getBoundingClientRect();
      const clickX = event.clientX - rect.left;
      const numPoints = simulationData[0].data.length;
      const cellWidth = canvas.clientWidth / numPoints;
      const xIndex = Math.floor(clickX / cellWidth);
  
      // Chama a função de clique passando o índice do ponto clicado
      onPointClick(xIndex);
    };

    canvas.addEventListener('click', handleCanvasClick);
    
    // Função de limpeza
    return () => {
      canvas.removeEventListener('click', handleCanvasClick);
    };
  }, [onPointClick, simulationData]); // Re-executa quando os dados mudam.

  // Mensagem exibida enquanto aguarda a simulação
  if (!simulationData || simulationData.length === 0) {
    return <p>Aguardando simulação...</p>;
  }

  // Renderiza o elemento
  return (
    <div style={{ padding: '20px', textAlign: 'center' }}>
      <h2>Visualização do estímulo</h2>
      <canvas 
        ref={canvasRef} 
        height="50" 
        style={{ 
          width: '100%', 
          border: '1px solid #ccc', 
          backgroundColor: '#f0f0f0' 
        }}
      ></canvas>
    </div>
  );
};

// Exporta o componente
export default memo(SpatiotemporalChart);