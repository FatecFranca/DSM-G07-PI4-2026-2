import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DIR_DADOS } from './config.js';

function carregarSegredo() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  const arquivo = path.join(DIR_DADOS, 'segredo-jwt.txt');
  fs.mkdirSync(DIR_DADOS, { recursive: true });
  if (fs.existsSync(arquivo)) return fs.readFileSync(arquivo, 'utf8').trim();
  const novo = crypto.randomBytes(48).toString('hex');
  fs.writeFileSync(arquivo, novo);
  return novo;
}

const SEGREDO = carregarSegredo();
const b64 = (x) => Buffer.from(x).toString('base64url');
const assinar = (dados) => crypto.createHmac('sha256', SEGREDO).update(dados).digest('base64url');

export function hashSenha(senha) {
  const sal = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(senha, sal, 64).toString('hex');
  return `${sal}:${hash}`;
}

export function conferirSenha(senha, armazenado) {
  const [sal, hash] = String(armazenado).split(':');
  if (!sal || !hash) return false;
  const calculado = crypto.scryptSync(senha, sal, 64);
  const esperado = Buffer.from(hash, 'hex');
  return esperado.length === calculado.length && crypto.timingSafeEqual(calculado, esperado);
}

export function gerarToken(usuario, validadeSegundos = 86400) {
  const cabecalho = b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const corpo = b64(JSON.stringify({ sub: usuario.id, papel: usuario.papel, exp: Math.floor(Date.now() / 1000) + validadeSegundos }));
  return `${cabecalho}.${corpo}.${assinar(`${cabecalho}.${corpo}`)}`;
}

export function lerToken(token) {
  if (typeof token !== 'string') return null;
  const partes = token.split('.');
  if (partes.length !== 3) return null;
  const esperado = Buffer.from(assinar(`${partes[0]}.${partes[1]}`));
  const recebido = Buffer.from(partes[2]);
  if (esperado.length !== recebido.length || !crypto.timingSafeEqual(esperado, recebido)) return null;
  try {
    const dados = JSON.parse(Buffer.from(partes[1], 'base64url').toString());
    return dados.exp > Math.floor(Date.now() / 1000) ? dados : null;
  } catch {
    return null;
  }
}

export const gerarChaveIot = () => `iot_${crypto.randomBytes(18).toString('hex')}`;
