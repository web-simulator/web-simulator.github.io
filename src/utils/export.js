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

// Normaliza valores pequenos ou grandes
const sanitizeValue = (val) => {
    if (val === undefined || val === null || isNaN(val) || !isFinite(val)) {
        return 0;
    }
    return Math.max(0, Math.min(1, val));
};

// Define a cor
const getHeatmapColor = (normValue) => {
    const hue = (1 - normValue) * 240; 
    return `hsl(${hue}, 100%, 50%)`;
};

// Exporta para gif
export const export1DToGif = (simulationData, params, fileNamePrefix = '1d_simulation', labels = {}, viewMode = 'line') => {
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

        // Limites
        let minV = -0.1;
        let maxV = 1.1;
        const rangeY = maxV - minV;
        const rangeX = params.L || 100;

        // Controle de Frames
        const MAX_FRAMES = 500; 
        let baseStep = 5; 
        let totalFrames = Math.floor(simulationData.length / baseStep);
        if (totalFrames > MAX_FRAMES) baseStep = Math.ceil(simulationData.length / MAX_FRAMES);
        const step = Math.max(1, baseStep);
        const GIF_DELAY = 150; 

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
                    let val = point.v;
                    if (isNaN(val)) val = minV;
                    const y = (height - padding) - ((val - minV) / rangeY) * (height - 2 * padding);
                    if (index === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                });
                ctx.stroke();
                ctx.font = '12px sans-serif';
                ctx.fillText(txtPot, padding + 10, padding + 10);
                ctx.fillText(txtPos, width - 100, height - padding - 10);

            } else { // Gráfico de cores
                const stripHeight = 100; 
                const stripY = (height - stripHeight) / 2;
                const drawWidth = width - 2 * padding;
                const numPoints = points.length;
                const cellWidth = drawWidth / numPoints;

                for (let j = 0; j < numPoints; j++) {
                    const point = points[j];
                    const norm = sanitizeValue((point.v - minV) / rangeY);
                    ctx.fillStyle = getHeatmapColor(norm);
                    ctx.fillRect(padding + (j * cellWidth), stripY, Math.ceil(cellWidth), stripHeight);
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
            console.error("Erro ao renderizar GIF 1D.", e);
            reject(e);
        }
    });
};


// Exporta para gif 2D
export const export2DToGif = (simulationResult, params, fileNamePrefix = '2d_simulation', labels = {}) => {
    return new Promise((resolve, reject) => {
        if (!simulationResult || !simulationResult.frames) {
            alert("Sem dados para exportar.");
            reject("No data");
            return;
        }

        const { frames, times, N, totalFrames, fibrosis } = simulationResult;

        const canvasSize = 600; 
        const padding = 20; 
        const footerHeight = 60; 
        const width = canvasSize + 2 * padding;
        const height = canvasSize + 2 * padding + footerHeight;

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false; 

        const gif = new GIF({
            workers: 4,
            quality: 10,
            width: width,
            height: height,
            workerScript: '/gif.worker.js'
        });

        // Escalas
        let minV = 0.0;
        let maxV = 1.0; 
        if (params && params.modelType === 'minimal') {
             maxV = 1.6;
        }
        const rangeV = maxV - minV;
        
        // Passo entre os rames
        const dataDt = (params.dt || 0.1) * (params.downsamplingFactor || 1);
        const targetGifRes = 2.0; 
        let step = Math.round(targetGifRes / dataDt);
        if (step < 1) step = 1;

        
        if ((totalFrames / step) > 800) {
            step = Math.ceil(totalFrames / 800);
        }
        
        const GIF_DELAY = 150;
        const cellSize = canvasSize / N;
        const hasFibrosis = fibrosis && fibrosis.length === N * N; // Celula fibrótica

        for (let f = 0; f < totalFrames; f += step) {
            const offset = f * N * N;
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, width, height);

            // Mostra as células
            for (let y = 0; y < N; y++) {
                for (let x = 0; x < N; x++) {
                    const idx = y * N + x;

                    // Se for fibrose marca de preto
                    if (hasFibrosis && fibrosis[idx] < 1e-5) {
                        ctx.fillStyle = '#000000'; 
                    } else {
                        const val = frames[offset + idx];
                        const norm = sanitizeValue((val - minV) / rangeV);
                        ctx.fillStyle = getHeatmapColor(norm);
                    }

                    ctx.fillRect(
                        padding + x * cellSize, 
                        padding + y * cellSize, 
                        Math.ceil(cellSize), 
                        Math.ceil(cellSize)
                    );
                }
            }

            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 1;
            ctx.strokeRect(padding, padding, canvasSize, canvasSize);

            // tempo
            const currentTime = times[f];
            ctx.fillStyle = '#1e293b'; 
            ctx.font = 'bold 16px sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText(`${labels.time_ms || 'Tempo: '}${currentTime ? currentTime.toFixed(1) : 0} ms`, padding, height - 25);

            // Corres Legenda
            const legW = 200;
            const legH = 15;
            const legX = width - legW - padding;
            const legY = height - 35;

            const grad = ctx.createLinearGradient(legX, 0, legX + legW, 0);
            grad.addColorStop(0, 'blue');
            grad.addColorStop(0.5, 'lime');
            grad.addColorStop(1, 'red');
            ctx.fillStyle = grad;
            ctx.fillRect(legX, legY, legW, legH);

            ctx.fillStyle = '#64748b'; 
            ctx.font = '12px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(minV.toFixed(1), legX, legY + legH + 12);
            ctx.fillText(maxV.toFixed(1), legX + legW, legY + legH + 12);
            ctx.fillText(labels.potential || 'V', legX + legW / 2, legY + legH + 12);

            gif.addFrame(ctx, { copy: true, delay: GIF_DELAY });
        }

        gif.on('finished', (blob) => {
            const link = document.createElement('a');
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            link.href = URL.createObjectURL(blob);
            link.download = `${fileNamePrefix}_${timestamp}.gif`;
            link.click();
            resolve();
        });

        try {
            gif.render();
        } catch (e) {
            console.error("Erro ao renderizar GIF 2D.", e);
            reject(e);
        }
    });
};