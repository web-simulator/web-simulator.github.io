import { toPng } from 'html-to-image';
import GIF from 'gif.js/dist/gif';

export const exportToPng = async (elementRef, fileNamePrefix = 'simulacao') => {
  if (!elementRef.current) return;

  try {
    const dataUrl = await toPng(elementRef.current, {
      cacheBust: true,
      backgroundColor: '#ffffff',
      pixelRatio: 2,
    });

    const link = document.createElement('a');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    link.download = `${fileNamePrefix}_${timestamp}.png`;
    link.href = dataUrl;
    link.click();
  } catch (err) {
    console.error('Erro ao exportar a imagem:', err);
    alert('Não foi possível exportar a imagem.');
  }
};

// Coloca o heatmap no gif
const getHeatmapColor = (value) => {
    // Clampa o valor entre 0 e 1
    const v = Math.max(0, Math.min(1, value));
    // 240 (Azul) -> 0 (Vermelho)
    const hue = (1 - v) * 240; 
    return `hsl(${hue}, 100%, 50%)`;
};

// Exporta para gi
export const export1DToGif = (simulationData, params, fileNamePrefix = 'simulacao_1d', labels = {}, viewMode = 'line') => {
    return new Promise((resolve, reject) => {
        if (!simulationData || simulationData.length === 0) {
            alert("Sem dados para exportar.");
            reject("No data");
            return;
        }

        const width = 800;
        const height = 400;
        const padding = 40;

        // Textos padrão
        const txtTime = labels.time_ms || 'Tempo: ';
        const txtPot = labels.potential || 'Potencial (V)';
        const txtPos = labels.position || 'Posição (cm)';

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        const gif = new GIF({
            workers: 2,
            quality: 10,
            width: width,
            height: height,
            workerScript: '/gif.worker.js' 
        });

        // Limites para normalização
        let minV = -0.1;
        let maxV = 1.1;
        const rangeY = maxV - minV;
        const rangeX = params.L || 100;

        // máximo de frames para o GIF
        const MAX_FRAMES = 500; 
        
        // Dowsamling dos frames
        let baseStep = 5;
        
        // Total de quadros
        let totalFrames = Math.floor(simulationData.length / baseStep);

        
        if (totalFrames > MAX_FRAMES) {
            baseStep = Math.ceil(simulationData.length / MAX_FRAMES);
        }

        const step = Math.max(1, baseStep);
        
        // FPS
        const GIF_DELAY = 10; 

        for (let i = 0; i < simulationData.length; i += step) {
            const frame = simulationData[i];
            const points = frame.data;

            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, width, height);

            ctx.fillStyle = '#334155'; 
            ctx.font = 'bold 16px sans-serif';
            ctx.textAlign = 'right';
            ctx.fillText(`${txtTime}${parseFloat(frame.time).toFixed(1)} ms`, width - padding, padding);
            ctx.textAlign = 'left';

            if (viewMode === 'line') { // Para gráfico de linhas
              
                ctx.beginPath();
                ctx.strokeStyle = '#cbd5e1'; 
                ctx.lineWidth = 1;
                ctx.moveTo(padding, padding);
                ctx.lineTo(padding, height - padding);
                ctx.lineTo(width - padding, height - padding);
                ctx.stroke();

                ctx.beginPath();
                ctx.strokeStyle = '#059669'; 
                ctx.lineWidth = 2;

                points.forEach((point, index) => {
                    const x = padding + (index * (params.dx || 1) / rangeX) * (width - 2 * padding);
                    const y = (height - padding) - ((point.v - minV) / rangeY) * (height - 2 * padding);
                    if (index === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                });
                ctx.stroke();

                ctx.font = '12px sans-serif';
                ctx.fillText(txtPot, padding + 10, padding + 10);
                ctx.fillText(txtPos, width - 100, height - padding - 10);

            } else { // Para heatmap
                const stripHeight = 100; 
                const stripY = (height - stripHeight) / 2;
                const drawWidth = width - 2 * padding;
                const numPoints = points.length;
                const cellWidth = drawWidth / numPoints;

                for (let j = 0; j < numPoints; j++) {
                    const point = points[j];
                    const normalizedV = (point.v - minV) / rangeY;
                    ctx.fillStyle = getHeatmapColor(normalizedV);
                    ctx.fillRect(padding + (j * cellWidth), stripY, cellWidth + 1, stripHeight);
                }

                ctx.strokeStyle = '#334155';
                ctx.lineWidth = 2;
                ctx.strokeRect(padding, stripY, drawWidth, stripHeight);

                ctx.fillStyle = '#334155';
                ctx.font = '12px sans-serif';
                ctx.fillText(`${txtPos} (0 - ${rangeX})`, padding, stripY + stripHeight + 20);
                
                // Legenda de Cores
                const legendWidth = 200;
                const legendHeight = 10;
                const legendX = (width - legendWidth) / 2;
                const legendY = stripY + stripHeight + 40;
                
                const gradient = ctx.createLinearGradient(legendX, 0, legendX + legendWidth, 0);
                gradient.addColorStop(0, 'blue');
                gradient.addColorStop(0.5, 'lime');
                gradient.addColorStop(1, 'red');
                ctx.fillStyle = gradient;
                ctx.fillRect(legendX, legendY, legendWidth, legendHeight);
                
                ctx.fillStyle = '#64748b';
                ctx.font = '10px sans-serif';
                ctx.fillText('Min V', legendX, legendY + 20);
                ctx.fillText('Max V', legendX + legendWidth - 30, legendY + 20);
            }

            gif.addFrame(ctx, { copy: true, delay: GIF_DELAY });
        }

        gif.on('finished', (blob) => {
            const link = document.createElement('a');
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            link.href = URL.createObjectURL(blob);
            link.download = `${fileNamePrefix}_${viewMode}_${timestamp}.gif`;
            link.click();
            resolve();
        });

        try {
            gif.render();
        } catch (e) {
            console.error("Erro ao renderizar GIF.", e);
            reject(e);
        }
    });
};