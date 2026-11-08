import { buscar, consultar, executar, transacao } from '../banco.js';
import { agora, arredonda, erro, exigirNumero, inteiro } from '../util.js';
import { exigirMercado } from '../permissoes.js';
import { LIMITE_OFFLINE_MS } from '../config.js';

const RETENCAO_MS = 6 * 3600 * 1000;
let contadorLimpeza = 0;

function mercadoDaChave(req) {
  const chave = req.headers['x-chave-iot'];
  const mercado = chave ? buscar('SELECT id, nome FROM mercados WHERE chave_iot = ?', String(chave)) : null;
  if (!mercado) throw erro(401, 'Chave IoT ausente ou inválida (cabeçalho X-Chave-Iot)');
  return mercado;
}

function notificarMercado(mercadoId, tipo, mensagem) {
  for (const u of consultar("SELECT id FROM usuarios WHERE mercado_id = ? AND papel = 'MERCADO'", mercadoId)) {
    executar('INSERT INTO notificacoes (usuario_id, tipo, mensagem, criada_em) VALUES (?,?,?,?)', u.id, tipo, mensagem, agora());
  }
}

function avaliarRegras(d, valor) {
  let violacao = null;
  if (d.tipo === 'TEMPERATURA') {
    if (d.limite_max !== null && valor > d.limite_max) {
      violacao = { tipo: 'TEMPERATURA_ALTA', mensagem: `${d.local}: temperatura de ${valor.toFixed(1)}°C acima do limite de ${d.limite_max}°C` };
    } else if (d.limite_min !== null && valor < d.limite_min) {
      violacao = { tipo: 'TEMPERATURA_BAIXA', mensagem: `${d.local}: temperatura de ${valor.toFixed(1)}°C abaixo do limite de ${d.limite_min}°C` };
    }
  } else if (d.tipo === 'PESO' && d.limite_min !== null && valor < d.limite_min) {
    const unidades = d.peso_unitario ? Math.floor(valor / d.peso_unitario) : 0;
    violacao = { tipo: 'REPOSICAO', mensagem: `${d.local}: estoque da gôndola baixo (${unidades} un.) — reposição necessária` };
  }
  const aberto = buscar('SELECT id, tipo FROM alertas WHERE dispositivo_id = ? AND resolvido_em IS NULL', d.id);
  if (!violacao) {
    if (aberto) executar('UPDATE alertas SET resolvido_em = ? WHERE dispositivo_id = ? AND resolvido_em IS NULL', agora(), d.id);
    return;
  }
  if (aberto && aberto.tipo === violacao.tipo) return;
  if (aberto) executar('UPDATE alertas SET resolvido_em = ? WHERE id = ?', agora(), aberto.id);
  executar('INSERT INTO alertas (mercado_id, dispositivo_id, tipo, mensagem, valor, criado_em) VALUES (?,?,?,?,?,?)', d.mercado_id, d.id, violacao.tipo, violacao.mensagem, valor, agora());
  notificarMercado(d.mercado_id, 'ALERTA_IOT', violacao.mensagem);
}

export function registrarLeituras(mercado, leituras) {
  if (!Array.isArray(leituras) || !leituras.length) throw erro(400, 'Envie "leituras": [{ dispositivo_id, valor }]');
  if (leituras.length > 500) throw erro(413, 'Máximo de 500 leituras por requisição');
  const dispositivos = new Map(consultar('SELECT * FROM dispositivos WHERE mercado_id = ?', mercado.id).map((d) => [d.id, d]));
  const rejeitadas = [];
  let aceitas = 0;

  transacao(() => {
    for (const l of leituras) {
      const d = dispositivos.get(Number(l.dispositivo_id));
      const valor = Number(l.valor);
      if (!d) { rejeitadas.push({ dispositivo_id: l.dispositivo_id, motivo: 'Dispositivo não pertence a este mercado' }); continue; }
      if (!Number.isFinite(valor)) { rejeitadas.push({ dispositivo_id: l.dispositivo_id, motivo: 'Valor inválido' }); continue; }
      let quando = l.em ? new Date(l.em) : new Date();
      if (Number.isNaN(quando.getTime()) || quando.getTime() > Date.now() + 10000) quando = new Date();
      const instante = quando.toISOString();

      let valorFinal = valor;
      if (d.papel === 'ATUADOR') {
        if (d.modo === 'AUTO') {
          const novo = valor >= 0.5 ? 1 : 0;
          if (novo !== d.estado) {
            executar('UPDATE dispositivos SET estado = ? WHERE id = ?', novo, d.id);
            executar('INSERT INTO eventos_atuador (dispositivo_id, estado, modo, origem, registrado_em) VALUES (?,?,?,?,?)', d.id, novo, 'AUTO', 'DISPOSITIVO', instante);
            d.estado = novo;
          }
        }
        valorFinal = d.estado;
      }
      executar('INSERT INTO leituras (dispositivo_id, valor, registrada_em) VALUES (?,?,?)', d.id, valorFinal, instante);
      executar('UPDATE dispositivos SET ultimo_valor = ?, ultima_leitura_em = ? WHERE id = ?', valorFinal, instante, d.id);
      aceitas++;

      if (d.papel === 'SENSOR') avaliarRegras(d, valorFinal);
      if (d.tipo === 'PESO' && d.produto_id && d.peso_unitario) {
        executar('UPDATE precos SET estoque = ?, atualizado_em = ? WHERE produto_id = ? AND mercado_id = ?', Math.max(0, Math.floor(valorFinal / d.peso_unitario + 1e-9)), instante, d.produto_id, d.mercado_id);
      }
    }
  });

  if (++contadorLimpeza % 100 === 0) {
    executar('DELETE FROM leituras WHERE registrada_em < ?', new Date(Date.now() - RETENCAO_MS).toISOString());
  }

  const comandos = consultar("SELECT id AS dispositivo_id, estado, modo FROM dispositivos WHERE mercado_id = ? AND papel = 'ATUADOR'", mercado.id);
  return { aceitas, rejeitadas, comandos };
}

function dispositivoComStatus(d) {
  const online = d.ultima_leitura_em ? Date.now() - new Date(d.ultima_leitura_em).getTime() < LIMITE_OFFLINE_MS : false;
  const estoque = d.tipo === 'PESO' && d.peso_unitario && d.ultimo_valor !== null ? Math.floor(d.ultimo_valor / d.peso_unitario + 1e-9) : null;
  return { ...d, online, estoque_estimado: estoque };
}

function dispositivosDoMercado(mercadoId) {
  return consultar(
    `SELECT d.*, p.nome AS produto_nome FROM dispositivos d LEFT JOIN produtos p ON p.id = d.produto_id WHERE d.mercado_id = ? ORDER BY d.id`, mercadoId,
  ).map(dispositivoComStatus);
}

function painel(mercadoId, pontos) {
  const mercado = buscar('SELECT id, nome, endereco FROM mercados WHERE id = ?', mercadoId);
  if (!mercado) throw erro(404, 'Mercado não encontrado');
  const dispositivos = dispositivosDoMercado(mercadoId).map((d) => ({
    ...d,
    serie: consultar('SELECT valor AS v, registrada_em AS t FROM leituras WHERE dispositivo_id = ? ORDER BY id DESC LIMIT ?', d.id, pontos).reverse(),
  }));
  const alertas = consultar(
    `SELECT a.id, a.dispositivo_id, a.tipo, a.mensagem, a.valor, a.criado_em, a.resolvido_em, d.nome AS dispositivo
     FROM alertas a JOIN dispositivos d ON d.id = a.dispositivo_id WHERE a.mercado_id = ? ORDER BY a.id DESC LIMIT 30`, mercadoId,
  );
  const sensores = dispositivos.filter((d) => d.papel === 'SENSOR');
  const atuadores = dispositivos.filter((d) => d.papel === 'ATUADOR');
  return {
    mercado,
    dispositivos,
    alertas,
    resumo: {
      sensores: sensores.length,
      sensores_online: sensores.filter((d) => d.online).length,
      atuadores: atuadores.length,
      atuadores_ligados: atuadores.filter((d) => d.estado === 1).length,
      alertas_abertos: alertas.filter((a) => !a.resolvido_em).length,
      leituras_total: buscar('SELECT COUNT(*) AS n FROM leituras l JOIN dispositivos d ON d.id = l.dispositivo_id WHERE d.mercado_id = ?', mercadoId).n,
    },
    atualizado_em: agora(),
  };
}

export const rotasIot = [
  {
    metodo: 'POST', caminho: '/api/iot/leituras', tag: 'IoT – Dispositivos', seguranca: 'chaveIot',
    resumo: 'Recebe leituras de sensores/atuadores (HTTP/JSON) e devolve os comandos pendentes dos atuadores',
    corpo: { leituras: ['array', [{ dispositivo_id: 1, valor: 4.2, 'em?': '2026-11-07T14:00:00Z' }], 'Leituras enviadas pelo dispositivo ou gateway'] },
    handler: ({ req, corpo }) => registrarLeituras(mercadoDaChave(req), corpo.leituras),
  },
  {
    metodo: 'GET', caminho: '/api/iot/dispositivos', tag: 'IoT – Dispositivos', seguranca: 'chaveIot', resumo: 'Lista os dispositivos do mercado dono da chave IoT (usado pelo simulador/gateway)',
    handler: ({ req }) => dispositivosDoMercado(mercadoDaChave(req).id),
  },
  {
    metodo: 'GET', caminho: '/api/iot/mercados/:mercadoId/painel', tag: 'IoT – Painel', papeis: ['MERCADO', 'ADMIN'], resumo: 'Dashboard do mercado: dispositivos, últimas leituras, alertas e indicadores',
    query: [['pontos', 'integer', 'Quantidade de pontos da série de cada dispositivo (padrão 40)']],
    handler: ({ params, query, usuario }) => painel(exigirMercado(usuario, params.mercadoId), Math.min(Math.max(inteiro(query.pontos, 40), 5), 300)),
  },
  {
    metodo: 'GET', caminho: '/api/iot/mercados/:mercadoId/chave', tag: 'IoT – Painel', papeis: ['MERCADO', 'ADMIN'], resumo: 'Chave IoT usada pelos dispositivos para enviar leituras',
    handler: ({ params, usuario }) => ({ chave: buscar('SELECT chave_iot FROM mercados WHERE id = ?', exigirMercado(usuario, params.mercadoId)).chave_iot }),
  },
  {
    metodo: 'GET', caminho: '/api/iot/mercados/:mercadoId/eventos', tag: 'IoT – Painel', papeis: ['MERCADO', 'ADMIN'], resumo: 'Histórico de acionamentos dos atuadores',
    handler: ({ params, usuario }) =>
      consultar(
        `SELECT e.id, e.dispositivo_id, d.nome AS dispositivo, e.estado, e.modo, e.origem, e.registrado_em
         FROM eventos_atuador e JOIN dispositivos d ON d.id = e.dispositivo_id WHERE d.mercado_id = ? ORDER BY e.id DESC LIMIT 30`,
        exigirMercado(usuario, params.mercadoId),
      ),
  },
  {
    metodo: 'GET', caminho: '/api/iot/dispositivos/:id/leituras', tag: 'IoT – Painel', papeis: ['MERCADO', 'ADMIN'], resumo: 'Leituras históricas de um dispositivo',
    query: [['minutos', 'integer', 'Janela de tempo em minutos (padrão 60)'], ['limite', 'integer', 'Máximo de pontos (padrão 500)']],
    handler: ({ params, query, usuario }) => {
      const d = buscar('SELECT * FROM dispositivos WHERE id = ?', Number(params.id));
      if (!d) throw erro(404, 'Dispositivo não encontrado');
      exigirMercado(usuario, d.mercado_id);
      const desde = new Date(Date.now() - Math.min(Math.max(inteiro(query.minutos, 60), 1), 360) * 60000).toISOString();
      const limite = Math.min(Math.max(inteiro(query.limite, 500), 1), 3000);
      const leituras = consultar('SELECT valor, registrada_em FROM leituras WHERE dispositivo_id = ? AND registrada_em >= ? ORDER BY id DESC LIMIT ?', d.id, desde, limite).reverse();
      return { dispositivo: dispositivoComStatus(d), leituras };
    },
  },
  {
    metodo: 'PUT', caminho: '/api/iot/dispositivos/:id/atuador', tag: 'IoT – Atuadores', papeis: ['MERCADO', 'ADMIN'],
    resumo: 'Aciona um atuador (liga/desliga) ou devolve o controle ao modo automático',
    corpo: { 'estado?': ['boolean', true, 'true = ligado. Ao informar o estado o modo vira MANUAL'], 'modo?': ['string', 'MANUAL', 'AUTO | MANUAL'] },
    handler: ({ params, corpo, usuario }) => {
      const d = buscar('SELECT * FROM dispositivos WHERE id = ?', Number(params.id));
      if (!d) throw erro(404, 'Dispositivo não encontrado');
      exigirMercado(usuario, d.mercado_id);
      if (d.papel !== 'ATUADOR') throw erro(400, 'Este dispositivo é um sensor e não pode ser acionado');
      let modo = d.modo;
      let estado = d.estado;
      if (corpo.modo !== undefined) {
        if (!['AUTO', 'MANUAL'].includes(corpo.modo)) throw erro(400, 'Modo inválido (use AUTO ou MANUAL)');
        modo = corpo.modo;
      }
      if (corpo.estado !== undefined) {
        if (typeof corpo.estado !== 'boolean' && ![0, 1].includes(corpo.estado)) throw erro(400, 'Estado deve ser true/false');
        estado = corpo.estado ? 1 : 0;
        if (corpo.modo === undefined) modo = 'MANUAL';
      }
      if (corpo.estado === undefined && corpo.modo === undefined) throw erro(400, 'Informe "estado" e/ou "modo"');
      executar('UPDATE dispositivos SET estado = ?, modo = ? WHERE id = ?', estado, modo, d.id);
      executar('INSERT INTO eventos_atuador (dispositivo_id, estado, modo, origem, registrado_em) VALUES (?,?,?,?,?)', d.id, estado, modo, `USUARIO:${usuario.email}`, agora());
      return dispositivoComStatus(buscar('SELECT * FROM dispositivos WHERE id = ?', d.id));
    },
  },
];

export { painel };
