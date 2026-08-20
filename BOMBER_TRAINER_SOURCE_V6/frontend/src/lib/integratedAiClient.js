const integratedAiClient = {
  async stream(path, { body, signal } = {}) {
    const payload = JSON.stringify(body || {});
    const headers = {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
    };

    const endpoints = path === '/integrated-ai/stream'
      ? [`/api/integrated-ai/stream?_=${Date.now()}`, '/api/integrated-ai']
      : [`/api${path}`];

    let lastError = null;

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers,
          cache: 'no-store',
          body: payload,
          signal,
        });

        if (response.ok && response.body) return response;

        let message = `Error de IA (${response.status})`;
        try {
          const data = await response.json();
          message = data?.error || data?.detail || message;
        } catch (_) {}
        lastError = new Error(message);
      } catch (error) {
        if (error?.name === 'AbortError') throw error;
        lastError = error;
      }
    }

    throw lastError || new Error('No s’ha pogut connectar amb la IA.');
  },
};

export { integratedAiClient };
export default integratedAiClient;
