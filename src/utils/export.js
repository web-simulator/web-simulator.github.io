import { toPng } from 'html-to-image';
// Função para exportar simulações como PNG
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