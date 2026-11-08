import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { ARQUIVO_BANCO } from './config.js';

fs.mkdirSync(path.dirname(ARQUIVO_BANCO), { recursive: true });

export const db = new DatabaseSync(ARQUIVO_BANCO);

db.exec(`
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS mercados (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL UNIQUE,
  endereco TEXT,
  cnpj TEXT,
  chave_iot TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  senha_hash TEXT NOT NULL,
  papel TEXT NOT NULL CHECK (papel IN ('USUARIO','MERCADO','ADMIN')),
  mercado_id INTEGER REFERENCES mercados(id) ON DELETE SET NULL,
  criado_em TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS categorias (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL UNIQUE,
  icone TEXT
);

CREATE TABLE IF NOT EXISTS produtos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL UNIQUE,
  nome_busca TEXT NOT NULL,
  categoria_id INTEGER NOT NULL REFERENCES categorias(id),
  imagem_url TEXT
);
CREATE INDEX IF NOT EXISTS idx_produtos_busca ON produtos(nome_busca);

CREATE TABLE IF NOT EXISTS precos (
  produto_id INTEGER NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
  mercado_id INTEGER NOT NULL REFERENCES mercados(id) ON DELETE CASCADE,
  preco REAL NOT NULL,
  estoque INTEGER NOT NULL DEFAULT 0,
  atualizado_em TEXT NOT NULL,
  PRIMARY KEY (produto_id, mercado_id)
);

CREATE TABLE IF NOT EXISTS historico_precos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  produto_id INTEGER NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
  mercado_id INTEGER NOT NULL REFERENCES mercados(id) ON DELETE CASCADE,
  preco REAL NOT NULL,
  registrado_em TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_historico ON historico_precos(produto_id, mercado_id, registrado_em);

CREATE TABLE IF NOT EXISTS listas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  criada_em TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS lista_itens (
  lista_id INTEGER NOT NULL REFERENCES listas(id) ON DELETE CASCADE,
  produto_id INTEGER NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
  quantidade INTEGER NOT NULL CHECK (quantidade > 0),
  PRIMARY KEY (lista_id, produto_id)
);

CREATE TABLE IF NOT EXISTS favoritos (
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  produto_id INTEGER NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
  PRIMARY KEY (usuario_id, produto_id)
);

CREATE TABLE IF NOT EXISTS notificacoes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  lida INTEGER NOT NULL DEFAULT 0,
  criada_em TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notificacoes ON notificacoes(usuario_id, lida);

CREATE TABLE IF NOT EXISTS dispositivos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mercado_id INTEGER NOT NULL REFERENCES mercados(id) ON DELETE CASCADE,
  codigo TEXT NOT NULL,
  nome TEXT NOT NULL,
  local TEXT,
  papel TEXT NOT NULL CHECK (papel IN ('SENSOR','ATUADOR')),
  natureza TEXT NOT NULL CHECK (natureza IN ('ANALOGICO','DIGITAL')),
  tipo TEXT NOT NULL,
  unidade TEXT,
  limite_min REAL,
  limite_max REAL,
  produto_id INTEGER REFERENCES produtos(id) ON DELETE SET NULL,
  peso_unitario REAL,
  capacidade REAL,
  estado INTEGER NOT NULL DEFAULT 0,
  modo TEXT NOT NULL DEFAULT 'AUTO' CHECK (modo IN ('AUTO','MANUAL')),
  ultimo_valor REAL,
  ultima_leitura_em TEXT,
  UNIQUE (mercado_id, codigo)
);

CREATE TABLE IF NOT EXISTS leituras (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dispositivo_id INTEGER NOT NULL REFERENCES dispositivos(id) ON DELETE CASCADE,
  valor REAL NOT NULL,
  registrada_em TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_leituras ON leituras(dispositivo_id, registrada_em);

CREATE TABLE IF NOT EXISTS eventos_atuador (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dispositivo_id INTEGER NOT NULL REFERENCES dispositivos(id) ON DELETE CASCADE,
  estado INTEGER NOT NULL,
  modo TEXT NOT NULL,
  origem TEXT NOT NULL,
  registrado_em TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS alertas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mercado_id INTEGER NOT NULL REFERENCES mercados(id) ON DELETE CASCADE,
  dispositivo_id INTEGER NOT NULL REFERENCES dispositivos(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  valor REAL,
  criado_em TEXT NOT NULL,
  resolvido_em TEXT
);
CREATE INDEX IF NOT EXISTS idx_alertas ON alertas(mercado_id, resolvido_em);
`);

export const consultar = (sql, ...params) => db.prepare(sql).all(...params);
export const buscar = (sql, ...params) => db.prepare(sql).get(...params);
export const executar = (sql, ...params) => {
  const r = db.prepare(sql).run(...params);
  return { alteradas: Number(r.changes), id: Number(r.lastInsertRowid) };
};

export function transacao(fn) {
  db.exec('BEGIN');
  try {
    const resultado = fn();
    db.exec('COMMIT');
    return resultado;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}
