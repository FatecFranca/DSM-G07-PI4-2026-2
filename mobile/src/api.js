import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const PORTA_API = 3333;
let base = null;
let token = null;

function enderecoAutomatico() {
  const origem = Constants.expoConfig?.hostUri || Constants.expoGoConfig?.debuggerHost || '';
  const host = origem.split(':')[0];
  return host ? `http://${host}:${PORTA_API}` : `http://localhost:${PORTA_API}`;
}

export async function iniciarApi() {
  const salvo = await AsyncStorage.getItem('bac_servidor');
  base = salvo || enderecoAutomatico();
  token = await AsyncStorage.getItem('bac_token');
  return { base, token };
}

export const servidorAtual = () => base;
export const servidorAutomatico = enderecoAutomatico;

export async function definirServidor(url) {
  const limpo = (url || '').trim().replace(/\/$/, '').replace(/\/api$/, '');
  if (limpo) await AsyncStorage.setItem('bac_servidor', limpo);
  else await AsyncStorage.removeItem('bac_servidor');
  base = limpo || enderecoAutomatico();
}

export async function definirToken(novo) {
  token = novo;
  if (novo) await AsyncStorage.setItem('bac_token', novo);
  else await AsyncStorage.removeItem('bac_token');
}

export async function chamar(metodo, caminho, corpo) {
  if (!base) await iniciarApi();
  const controle = new AbortController();
  const limite = setTimeout(() => controle.abort(), 8000);
  let resposta;
  try {
    resposta = await fetch(`${base}/api${caminho}`, {
      method: metodo,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
      signal: controle.signal,
    });
  } catch {
    throw new Error(`Não foi possível conectar em ${base}. Confirme que o servidor está rodando e que o celular está na mesma rede Wi-Fi (veja a aba Conta).`);
  } finally {
    clearTimeout(limite);
  }
  if (resposta.status === 204) return null;
  const dados = await resposta.json().catch(() => null);
  if (!resposta.ok) throw new Error((dados && dados.erro) || `Erro ${resposta.status}`);
  return dados;
}

export const api = {
  get: (c) => chamar('GET', c),
  post: (c, b) => chamar('POST', c, b ?? {}),
  put: (c, b) => chamar('PUT', c, b ?? {}),
  del: (c) => chamar('DELETE', c),
};

export const montarQuery = (obj) => {
  const partes = Object.entries(obj)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
  return partes.length ? `?${partes.join('&')}` : '';
};
