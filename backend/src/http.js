import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { buscar } from './banco.js';
import { lerToken } from './auth.js';
import { ErroHttp, erro } from './util.js';
import { DIR_WEB } from './config.js';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Chave-Iot',
};

export function compilarRota(def) {
  const chaves = [];
  const padrao = def.caminho.replace(/:([a-zA-Z_]+)/g, (_, nome) => {
    chaves.push(nome);
    return '([^/]+)';
  });
  return { ...def, regex: new RegExp(`^${padrao}/?$`), chaves };
}

function enviarJson(res, status, corpo) {
  const texto = JSON.stringify(corpo, (_, v) => (typeof v === 'number' && !Number.isFinite(v) ? null : v));
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...CORS });
  res.end(texto);
}

function lerCorpo(req) {
  return new Promise((resolve, reject) => {
    const partes = [];
    let tamanho = 0;
    req.on('data', (c) => {
      tamanho += c.length;
      if (tamanho > 1_000_000) {
        reject(erro(413, 'Corpo da requisição muito grande'));
        req.destroy();
      } else partes.push(c);
    });
    req.on('end', () => {
      if (!partes.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(partes).toString('utf8')));
      } catch {
        reject(erro(400, 'JSON inválido'));
      }
    });
    req.on('error', reject);
  });
}

function identificarUsuario(req) {
  const cab = req.headers.authorization || '';
  const token = cab.startsWith('Bearer ') ? cab.slice(7) : null;
  const dados = lerToken(token);
  if (!dados) return null;
  return buscar('SELECT id, nome, email, papel, mercado_id FROM usuarios WHERE id = ?', dados.sub) || null;
}

function servirEstatico(req, res, url) {
  if (!fs.existsSync(DIR_WEB)) return false;
  let alvo = path.normalize(path.join(DIR_WEB, decodeURIComponent(url.pathname)));
  if (!alvo.startsWith(DIR_WEB)) return false;
  if (!fs.existsSync(alvo) || fs.statSync(alvo).isDirectory()) alvo = path.join(DIR_WEB, 'index.html');
  if (!fs.existsSync(alvo)) return false;
  res.writeHead(200, { 'Content-Type': MIME[path.extname(alvo)] || 'application/octet-stream' });
  fs.createReadStream(alvo).pipe(res);
  return true;
}

export function criarServidor(definicoes) {
  const rotas = definicoes.map(compilarRota);

  return http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    try {
      if (req.method === 'OPTIONS') {
        res.writeHead(204, CORS);
        return res.end();
      }

      if (!url.pathname.startsWith('/api')) {
        if (req.method === 'GET' && servirEstatico(req, res, url)) return;
        return enviarJson(res, 404, { erro: 'Não encontrado. Use /api/docs para ver a documentação da API.' });
      }

      let achouCaminho = false;
      let rota = null;
      let params = {};
      for (const r of rotas) {
        const m = r.regex.exec(url.pathname);
        if (!m) continue;
        achouCaminho = true;
        if (r.metodo !== req.method) continue;
        rota = r;
        params = Object.fromEntries(r.chaves.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
        break;
      }
      if (!rota) return enviarJson(res, achouCaminho ? 405 : 404, { erro: achouCaminho ? 'Método não permitido' : 'Rota não encontrada' });

      const usuario = identificarUsuario(req);
      if (rota.papeis) {
        if (!usuario) throw erro(401, 'Autenticação necessária');
        if (rota.papeis.length && !rota.papeis.includes(usuario.papel)) throw erro(403, 'Sem permissão para este recurso');
      }

      const corpo = ['POST', 'PUT', 'PATCH'].includes(req.method) ? await lerCorpo(req) : {};
      const query = Object.fromEntries(url.searchParams);
      const resultado = await rota.handler({ req, params, query, corpo, usuario });
      if (resultado && resultado.__status === 204) {
        res.writeHead(204, CORS);
        return res.end();
      }
      if (resultado && resultado.__html) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', ...CORS });
        return res.end(resultado.__html);
      }
      if (resultado && resultado.__status) return enviarJson(res, resultado.__status, resultado.corpo ?? null);
      return enviarJson(res, 200, resultado ?? null);
    } catch (e) {
      if (e instanceof ErroHttp) return enviarJson(res, e.status, { erro: e.message, detalhes: e.detalhes });
      console.error('Erro interno:', e);
      return enviarJson(res, 500, { erro: 'Erro interno do servidor' });
    }
  });
}

export const criado = (corpo) => ({ __status: 201, corpo });
export const pagina = (__html) => ({ __html });
export const semConteudo = () => ({ __status: 204 });
