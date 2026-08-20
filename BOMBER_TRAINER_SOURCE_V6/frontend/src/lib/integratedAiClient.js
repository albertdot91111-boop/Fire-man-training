const integratedAiClient = {
  async stream(path, { body, signal } = {}) {
    const endpoint = path === '/integrated-ai/stream' ? '/api/integrated-ai' : `/api${path}`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
      signal,
    });

    if (!response.ok) {
      let message = `Error de IA (${response.status})`;
      try {
        const data = await response.json();
        message = data?.error || data?.detail || message;
      } catch (_) {}
      throw new Error(message);
    }

    if (!response.body) {
      throw new Error('El servidor d’IA no ha retornat cap flux.');
    }

    return response;
  },
};

export { integratedAiClient };
export default integratedAiClient;
