/**
 * Verifica se o navegador e o hardware do usuário suportam WebGPU nativamente.
 * @returns {Promise<boolean>}
 */
export async function checkWebGPUSupport() {
  // 1. Verifica se a API existe no navegador
  if (!navigator.gpu) {
    return false;
  }

  try {
    // 2. Requisita acesso a um adaptador de vídeo
    const adapter = await navigator.gpu.requestAdapter();
    
    // Se o adaptador for retornado, a GPU está pronta para uso
    return adapter !== null;
  } catch (error) {
    console.warn("WebGPU suportado pelo navegador, mas o adaptador falhou:", error);
    return false;
  }
}