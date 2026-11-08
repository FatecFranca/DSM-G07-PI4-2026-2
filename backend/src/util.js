export class ErroHttp extends Error {
  constructor(status, mensagem, detalhes) {
    super(mensagem);
    this.status = status;
    this.detalhes = detalhes;
  }
}

export const erro = (status, mensagem, detalhes) => new ErroHttp(status, mensagem, detalhes);
export const agora = () => new Date().toISOString();

export function arredonda(valor, casas = 4) {
  if (typeof valor !== 'number' || !Number.isFinite(valor)) return null;
  const f = 10 ** casas;
  return Math.round(valor * f) / f;
}

export function normaliza(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

export function exigirTexto(valor, campo, min = 1, max = 200) {
  if (typeof valor !== 'string') throw erro(400, `Campo "${campo}" é obrigatório`);
  const t = valor.trim();
  if (t.length < min || t.length > max) throw erro(400, `Campo "${campo}" deve ter entre ${min} e ${max} caracteres`);
  return t;
}

export function exigirNumero(valor, campo, { min = -Infinity, max = Infinity } = {}) {
  const n = typeof valor === 'string' && valor.trim() !== '' ? Number(valor) : valor;
  if (typeof n !== 'number' || !Number.isFinite(n)) throw erro(400, `Campo "${campo}" deve ser numérico`);
  if (n < min || n > max) throw erro(400, `Campo "${campo}" deve estar entre ${min} e ${max}`);
  return n;
}

export function numeroOpcional(valor, campo, limites) {
  if (valor === undefined || valor === null || valor === '') return null;
  return exigirNumero(valor, campo, limites);
}

export function inteiro(valor, padrao) {
  const n = Number.parseInt(valor, 10);
  return Number.isFinite(n) ? n : padrao;
}
