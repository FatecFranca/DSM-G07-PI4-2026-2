import { buscar, consultar, executar, transacao } from '../banco.js';
import { agora, arredonda, erro, exigirNumero, exigirTexto, inteiro, normaliza } from '../util.js';
import { criado, semConteudo } from '../http.js';
import { exigirMercado } from '../permissoes.js';
import { LIMITE_OFFLINE_MS } from '../config.js';

const CORPO_COMPARAR = {
  'itens': ['array', [{ produto_id: 1, quantidade: 2 }], 'Lista de itens com produto_id e quantidade'],
};

export function agruparOfertas(linhas) {
  const mapa = new Map();
  for (const l of linhas) {
    if (!mapa.has(l.produto_id)) {
      mapa.set(l.produto_id, {
        id: l.produto_id,
        nome: l.nome,
        imagem_url: l.imagem_url,
        categoria_id: l.categoria_id,
        categoria: l.categoria,
        icone: l.icone,
        ofertas: [],
      });
    }
    mapa.get(l.produto_id).ofertas.push({
      mercado_id: l.mercado_id,
      mercado: l.mercado,
      preco: l.preco,
      estoque: l.estoque,
      disponivel: l.estoque > 0,
      atualizado_em: l.atualizado_em,
    });
  }
  for (const p of mapa.values()) {
    p.ofertas.sort((a, b) => a.preco - b.preco);
    const disponiveis = p.ofertas.filter((o) => o.disponivel);
    const melhor = disponiveis[0] || null;
    p.ofertas.forEach((o) => { o.melhor = melhor ? o === melhor : false; });
    const precos = p.ofertas.map((o) => o.preco);
    p.menor_preco = Math.min(...precos);
    p.maior_preco = Math.max(...precos);
    p.economia = arredonda(p.maior_preco - p.menor_preco, 2);
    p.melhor_mercado = melhor ? melhor.mercado : null;
    p.melhor_preco = melhor ? melhor.preco : null;
  }
  return [...mapa.values()];
}

const SQL_OFERTAS = `
  SELECT p.id AS produto_id, p.nome, p.imagem_url, c.id AS categoria_id, c.nome AS categoria, c.icone,
         pr.mercado_id, m.nome AS mercado, pr.preco, pr.estoque, pr.atualizado_em
  FROM produtos p
  JOIN categorias c ON c.id = p.categoria_id
  JOIN precos pr ON pr.produto_id = p.id
  JOIN mercados m ON m.id = pr.mercado_id`;

export function buscarProdutos({ q, categoria, mercado, min, max, ordem, pagina, limite }) {
  const condicoes = [];
  const params = [];
  if (q && q.trim()) {
    for (const termo of normaliza(q).split(/\s+/)) {
      condicoes.push('p.nome_busca LIKE ?');
      params.push(`%${termo}%`);
    }
  }
  if (categoria) { condicoes.push('p.categoria_id = ?'); params.push(Number(categoria)); }
  if (mercado) { condicoes.push('pr.mercado_id = ?'); params.push(Number(mercado)); }
  if (min !== undefined && min !== '') { condicoes.push('pr.preco >= ?'); params.push(Number(min)); }
  if (max !== undefined && max !== '') { condicoes.push('pr.preco <= ?'); params.push(Number(max)); }
  const where = condicoes.length ? `WHERE ${condicoes.join(' AND ')}` : '';
  let produtos = agruparOfertas(consultar(`${SQL_OFERTAS} ${where}`, ...params));

  const ordenar = {
    preco: (a, b) => a.menor_preco - b.menor_preco,
    economia: (a, b) => b.economia - a.economia,
    nome: (a, b) => a.nome.localeCompare(b.nome, 'pt-BR'),
  }[ordem] || ((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  produtos.sort(ordenar);

  const total = produtos.length;
  const tam = Math.min(Math.max(inteiro(limite, 40), 1), 200);
  const pag = Math.max(inteiro(pagina, 1), 1);
  produtos = produtos.slice((pag - 1) * tam, pag * tam);
  return { total, pagina: pag, limite: tam, produtos };
}

export function compararItens(itens) {
  if (!Array.isArray(itens) || !itens.length) throw erro(400, 'Informe ao menos um item para comparar');
  const pedidos = new Map();
  for (const it of itens) {
    const id = Number(it.produto_id);
    const qtd = inteiro(it.quantidade, 1);
    if (!Number.isInteger(id) || qtd < 1) throw erro(400, 'Item inválido: use produto_id e quantidade >= 1');
    pedidos.set(id, (pedidos.get(id) || 0) + qtd);
  }
  const mercados = consultar('SELECT id, nome FROM mercados ORDER BY nome');
  const produtos = [];
  for (const [id, quantidade] of pedidos) {
    const p = buscar('SELECT id, nome FROM produtos WHERE id = ?', id);
    if (!p) throw erro(404, `Produto ${id} não encontrado`);
    produtos.push({ ...p, quantidade, ofertas: consultar('SELECT mercado_id, preco, estoque FROM precos WHERE produto_id = ?', id) });
  }

  const ranking = mercados.map((m) => {
    const itensM = [];
    const faltantes = [];
    let total = 0;
    for (const p of produtos) {
      const oferta = p.ofertas.find((o) => o.mercado_id === m.id && o.estoque > 0);
      if (!oferta) { faltantes.push(p.nome); continue; }
      const subtotal = arredonda(oferta.preco * p.quantidade, 2);
      total += subtotal;
      itensM.push({ produto_id: p.id, nome: p.nome, quantidade: p.quantidade, preco: oferta.preco, subtotal });
    }
    return {
      mercado_id: m.id,
      mercado: m.nome,
      total: arredonda(total, 2),
      disponiveis: itensM.length,
      total_itens: produtos.length,
      completo: faltantes.length === 0,
      cobertura: arredonda(itensM.length / produtos.length, 4),
      faltantes,
      itens: itensM,
    };
  }).filter((r) => r.disponiveis > 0);

  ranking.sort((a, b) => Number(b.completo) - Number(a.completo) || a.total - b.total);
  const completos = ranking.filter((r) => r.completo);

  const combinacao = [];
  let totalCombinacao = 0;
  for (const p of produtos) {
    const melhor = p.ofertas.filter((o) => o.estoque > 0).sort((a, b) => a.preco - b.preco)[0];
    if (!melhor) continue;
    const subtotal = arredonda(melhor.preco * p.quantidade, 2);
    totalCombinacao += subtotal;
    combinacao.push({
      produto_id: p.id,
      nome: p.nome,
      quantidade: p.quantidade,
      mercado_id: melhor.mercado_id,
      mercado: mercados.find((m) => m.id === melhor.mercado_id).nome,
      preco: melhor.preco,
      subtotal,
    });
  }

  const melhorMercado = ranking[0] || null;
  const segundo = completos[1] || null;
  const maisCaro = completos.length ? completos[completos.length - 1] : null;
  return {
    melhor_mercado: melhorMercado,
    ranking,
    economia_vs_segundo: melhorMercado && melhorMercado.completo && segundo ? arredonda(segundo.total - melhorMercado.total, 2) : 0,
    economia_vs_mais_caro: melhorMercado && melhorMercado.completo && maisCaro ? arredonda(maisCaro.total - melhorMercado.total, 2) : 0,
    combinacao_otima: {
      total: arredonda(totalCombinacao, 2),
      economia_vs_melhor_mercado: melhorMercado && melhorMercado.completo ? arredonda(melhorMercado.total - totalCombinacao, 2) : 0,
      itens: combinacao,
    },
  };
}

function statusCadeiaFria(mercadoId) {
  const sensores = consultar(
    "SELECT limite_min, limite_max, ultimo_valor, ultima_leitura_em FROM dispositivos WHERE mercado_id = ? AND tipo = 'TEMPERATURA'",
    mercadoId,
  );
  if (!sensores.length || sensores.some((s) => !s.ultima_leitura_em)) return 'SEM_DADOS';
  const limite = Date.now() - LIMITE_OFFLINE_MS * 6;
  if (sensores.every((s) => new Date(s.ultima_leitura_em).getTime() < limite)) return 'SEM_DADOS';
  const fora = sensores.some((s) => s.ultimo_valor > s.limite_max || s.ultimo_valor < s.limite_min);
  return fora ? 'ALERTA' : 'OK';
}

function registrarMudancaPreco(produtoId, mercadoId, precoNovo) {
  const antigo = buscar('SELECT preco FROM precos WHERE produto_id = ? AND mercado_id = ?', produtoId, mercadoId);
  if (!antigo || antigo.preco === precoNovo) return;
  executar('INSERT INTO historico_precos (produto_id, mercado_id, preco, registrado_em) VALUES (?,?,?,?)', produtoId, mercadoId, precoNovo, agora());
  if (precoNovo < antigo.preco) {
    const produto = buscar('SELECT nome FROM produtos WHERE id = ?', produtoId);
    const mercado = buscar('SELECT nome FROM mercados WHERE id = ?', mercadoId);
    const mensagem = `${produto.nome} baixou de R$ ${antigo.preco.toFixed(2)} para R$ ${precoNovo.toFixed(2)} no ${mercado.nome}`;
    for (const f of consultar('SELECT usuario_id FROM favoritos WHERE produto_id = ?', produtoId)) {
      executar('INSERT INTO notificacoes (usuario_id, tipo, mensagem, criada_em) VALUES (?,?,?,?)', f.usuario_id, 'PRECO', mensagem, agora());
    }
  }
}

export const rotasCatalogo = [
  {
    metodo: 'GET', caminho: '/api/saude', tag: 'Sistema', resumo: 'Verifica se a API está no ar',
    handler: () => ({ status: 'ok', hora: agora(), versao: '4.0.0' }),
  },
  {
    metodo: 'GET', caminho: '/api/categorias', tag: 'Catálogo', resumo: 'Lista as categorias de produtos',
    handler: () => consultar('SELECT id, nome, icone FROM categorias ORDER BY nome'),
  },
  {
    metodo: 'GET', caminho: '/api/mercados', tag: 'Catálogo', resumo: 'Lista os supermercados com o status da cadeia fria (sensores IoT)',
    handler: () => consultar('SELECT id, nome, endereco FROM mercados ORDER BY nome').map((m) => ({ ...m, cadeia_fria: statusCadeiaFria(m.id) })),
  },
  {
    metodo: 'GET', caminho: '/api/produtos', tag: 'Catálogo', resumo: 'Busca produtos com a comparação de preços entre supermercados',
    query: [
      ['q', 'string', 'Texto da busca (ignora acentos)'], ['categoria', 'integer', 'ID da categoria'], ['mercado', 'integer', 'ID do supermercado'],
      ['min', 'number', 'Preço mínimo'], ['max', 'number', 'Preço máximo'], ['ordem', 'string', 'preco | economia | nome'],
      ['pagina', 'integer', 'Página'], ['limite', 'integer', 'Itens por página (máx. 200)'],
    ],
    handler: ({ query }) => buscarProdutos(query),
  },
  {
    metodo: 'GET', caminho: '/api/produtos/:id', tag: 'Catálogo', resumo: 'Detalhes do produto com ofertas por mercado e histórico de preços',
    handler: ({ params, usuario }) => {
      const id = Number(params.id);
      const produto = agruparOfertas(consultar(`${SQL_OFERTAS} WHERE p.id = ?`, id))[0];
      if (!produto) {
        const existe = buscar('SELECT id FROM produtos WHERE id = ?', id);
        if (!existe) throw erro(404, 'Produto não encontrado');
      }
      const base = produto || { ...buscar('SELECT p.id, p.nome, p.imagem_url, c.id AS categoria_id, c.nome AS categoria, c.icone FROM produtos p JOIN categorias c ON c.id = p.categoria_id WHERE p.id = ?', id), ofertas: [] };
      const historico = consultar(
        `SELECT h.mercado_id, m.nome AS mercado, h.preco, h.registrado_em FROM historico_precos h JOIN mercados m ON m.id = h.mercado_id
         WHERE h.produto_id = ? ORDER BY h.registrado_em`, id,
      );
      const favorito = usuario ? !!buscar('SELECT 1 AS x FROM favoritos WHERE usuario_id = ? AND produto_id = ?', usuario.id, id) : false;
      return { ...base, historico, favorito };
    },
  },
  {
    metodo: 'POST', caminho: '/api/produtos', tag: 'Preços', papeis: ['MERCADO', 'ADMIN'], resumo: 'Cadastra um produto (se ainda não existir) e define o preço no mercado',
    corpo: {
      nome: ['string', 'Feijão Tropeiro 1kg'], 'categoria_id': ['integer', 1], 'preco': ['number', 9.9], 'estoque?': ['integer', 30],
      'mercado_id?': ['integer', 1, 'Obrigatório para ADMIN'], 'imagem_url?': ['string', 'https://...'],
    },
    handler: ({ corpo, usuario }) => {
      const nome = exigirTexto(corpo.nome, 'nome', 2, 120);
      const preco = exigirNumero(corpo.preco, 'preco', { min: 0.01, max: 100000 });
      const estoque = corpo.estoque === undefined ? 30 : exigirNumero(corpo.estoque, 'estoque', { min: 0, max: 1000000 });
      const mercadoId = exigirMercado(usuario, usuario.papel === 'ADMIN' ? corpo.mercado_id : usuario.mercado_id);
      return transacao(() => {
        let produto = buscar('SELECT id FROM produtos WHERE nome_busca = ?', normaliza(nome));
        if (!produto) {
          const categoria = buscar('SELECT id, nome FROM categorias WHERE id = ?', Number(corpo.categoria_id));
          if (!categoria) throw erro(400, 'Categoria inválida');
          const r = executar('INSERT INTO produtos (nome, nome_busca, categoria_id, imagem_url) VALUES (?,?,?,?)', nome, normaliza(nome), categoria.id, corpo.imagem_url || null);
          produto = { id: r.id };
        }
        registrarMudancaPreco(produto.id, mercadoId, preco);
        const existe = buscar('SELECT 1 AS x FROM precos WHERE produto_id = ? AND mercado_id = ?', produto.id, mercadoId);
        if (existe) {
          executar('UPDATE precos SET preco=?, estoque=?, atualizado_em=? WHERE produto_id=? AND mercado_id=?', preco, estoque, agora(), produto.id, mercadoId);
        } else {
          executar('INSERT INTO precos (produto_id, mercado_id, preco, estoque, atualizado_em) VALUES (?,?,?,?,?)', produto.id, mercadoId, preco, estoque, agora());
          executar('INSERT INTO historico_precos (produto_id, mercado_id, preco, registrado_em) VALUES (?,?,?,?)', produto.id, mercadoId, preco, agora());
        }
        return criado({ produto_id: produto.id, mercado_id: mercadoId, preco, estoque });
      });
    },
  },
  {
    metodo: 'GET', caminho: '/api/mercados/:mercadoId/precos', tag: 'Preços', papeis: ['MERCADO', 'ADMIN'], resumo: 'Tabela de preços e estoque do supermercado',
    handler: ({ params, usuario }) => {
      const mercadoId = exigirMercado(usuario, params.mercadoId);
      return consultar(
        `SELECT p.id AS produto_id, p.nome, c.nome AS categoria, pr.preco, pr.estoque, pr.atualizado_em,
                (SELECT COUNT(*) FROM dispositivos d WHERE d.produto_id = p.id AND d.mercado_id = pr.mercado_id) AS monitorado_por_iot
         FROM precos pr JOIN produtos p ON p.id = pr.produto_id JOIN categorias c ON c.id = p.categoria_id
         WHERE pr.mercado_id = ? ORDER BY p.nome`, mercadoId,
      );
    },
  },
  {
    metodo: 'PUT', caminho: '/api/mercados/:mercadoId/precos/:produtoId', tag: 'Preços', papeis: ['MERCADO', 'ADMIN'], resumo: 'Atualiza preço e/ou estoque de um produto no mercado',
    corpo: { 'preco?': ['number', 8.49], 'estoque?': ['integer', 40] },
    handler: ({ params, corpo, usuario }) => {
      const mercadoId = exigirMercado(usuario, params.mercadoId);
      const produtoId = Number(params.produtoId);
      const atual = buscar('SELECT preco, estoque FROM precos WHERE produto_id = ? AND mercado_id = ?', produtoId, mercadoId);
      if (!atual) throw erro(404, 'Este mercado não possui o produto');
      const preco = corpo.preco === undefined ? atual.preco : exigirNumero(corpo.preco, 'preco', { min: 0.01, max: 100000 });
      const estoque = corpo.estoque === undefined ? atual.estoque : exigirNumero(corpo.estoque, 'estoque', { min: 0, max: 1000000 });
      return transacao(() => {
        registrarMudancaPreco(produtoId, mercadoId, preco);
        executar('UPDATE precos SET preco=?, estoque=?, atualizado_em=? WHERE produto_id=? AND mercado_id=?', preco, estoque, agora(), produtoId, mercadoId);
        return { produto_id: produtoId, mercado_id: mercadoId, preco, estoque };
      });
    },
  },
  {
    metodo: 'DELETE', caminho: '/api/mercados/:mercadoId/precos/:produtoId', tag: 'Preços', papeis: ['MERCADO', 'ADMIN'], resumo: 'Remove o produto do catálogo do mercado',
    handler: ({ params, usuario }) => {
      const mercadoId = exigirMercado(usuario, params.mercadoId);
      const r = executar('DELETE FROM precos WHERE produto_id = ? AND mercado_id = ?', Number(params.produtoId), mercadoId);
      if (!r.alteradas) throw erro(404, 'Este mercado não possui o produto');
      return semConteudo();
    },
  },
  {
    metodo: 'POST', caminho: '/api/comparar', tag: 'Comparação', resumo: 'Compara o total de uma lista de compras em todos os supermercados (sem login)',
    corpo: CORPO_COMPARAR,
    handler: ({ corpo }) => compararItens(corpo.itens),
  },
];
