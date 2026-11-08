const BASE = '/api';

export const guardarToken = (t) => {
  try {
    if (t) localStorage.setItem('bac_token', t);
    else localStorage.removeItem('bac_token');
  } catch {}
};

export const lerToken = () => {
  try {
    return localStorage.getItem('bac_token');
  } catch {
    return null;
  }
};

export async function chamar(metodo, caminho, corpo) {
  const token = lerToken();
  let resposta;
  try {
    resposta = await fetch(BASE + caminho, {
      method: metodo,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    });
  } catch {
    throw new Error('Não foi possível conectar à API. Verifique se o servidor está rodando.');
  }
  if (resposta.status === 204) return null;
  const dados = await resposta.json().catch(() => null);
  if (!resposta.ok) {
    const erro = new Error((dados && dados.erro) || `Erro ${resposta.status}`);
    erro.status = resposta.status;
    throw erro;
  }
  return dados;
}

export const api = {
  get: (c) => chamar('GET', c),
  post: (c, b) => chamar('POST', c, b ?? {}),
  put: (c, b) => chamar('PUT', c, b ?? {}),
  del: (c) => chamar('DELETE', c),
};

export const montarQuery = (obj) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(obj)) if (v !== undefined && v !== null && v !== '') p.set(k, v);
  const s = p.toString();
  return s ? `?${s}` : '';
};
