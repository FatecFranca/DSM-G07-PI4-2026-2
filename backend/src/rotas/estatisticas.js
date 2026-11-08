import { buscar, consultar } from '../banco.js';
import { arredonda, erro, inteiro } from '../util.js';
import { exigirMercado } from '../permissoes.js';
import {
  descritiva, histograma, intervaloConfianca, media, probabilidadeAbaixo, probabilidadeAcima, regressaoLinear, resumoRegressao,
} from '../estatistica.js';

const HORA = 3600000;

export function estatisticasDispositivo(d, minutos) {
  const desde = new Date(Date.now() - minutos * 60000).toISOString();
  const linhas = consultar('SELECT valor, registrada_em FROM leituras WHERE dispositivo_id = ? AND registrada_em >= ? ORDER BY id DESC LIMIT 3000', d.id, desde).reverse();
  const valores = linhas.map((l) => l.valor);
  const t0 = linhas.length ? new Date(linhas[0].registrada_em).getTime() : 0;
  const horas = linhas.map((l) => (new Date(l.registrada_em).getTime() - t0) / HORA);
  const casas = d.natureza === 'DIGITAL' ? 0 : 1;

  const reg = regressaoLinear(horas, valores);
  const ic = intervaloConfianca(valores);
  const probabilidades = {};
  if (d.limite_max !== null) probabilidades.acima_do_limite_maximo = probabilidadeAcima(valores, d.limite_max);
  if (d.limite_min !== null) probabilidades.abaixo_do_limite_minimo = probabilidadeAbaixo(valores, d.limite_min);
  if (d.natureza === 'DIGITAL' && valores.length) {
    probabilidades.proporcao_ligado = arredonda(valores.filter((v) => v >= 0.5).length / valores.length);
  }

  const passoHoras = [0.25, 0.5, 1];
  return {
    dispositivo: { id: d.id, nome: d.nome, tipo: d.tipo, natureza: d.natureza, unidade: d.unidade, limite_min: d.limite_min, limite_max: d.limite_max },
    janela_minutos: minutos,
    descritiva: descritiva(valores, casas),
    histograma: histograma(valores).map((b) => ({ de: arredonda(b.de), ate: arredonda(b.ate), frequencia: b.frequencia })),
    intervalo_confianca_95: ic ? { inferior: arredonda(ic.inferior), superior: arredonda(ic.superior), margem: arredonda(ic.margem) } : null,
    probabilidades,
    regressao: resumoRegressao(reg, horas, valores, passoHoras, 1),
    serie: linhas.map((l, i) => ({ t: l.registrada_em, horas: arredonda(horas[i], 5), v: l.valor })),
  };
}

export function estatisticasProduto(produtoId) {
  const produto = buscar('SELECT id, nome FROM produtos WHERE id = ?', produtoId);
  if (!produto) throw erro(404, 'Produto não encontrado');
  const ofertas = consultar('SELECT m.id AS mercado_id, m.nome AS mercado, pr.preco FROM precos pr JOIN mercados m ON m.id = pr.mercado_id WHERE pr.produto_id = ? ORDER BY pr.preco', produtoId);
  const precos = ofertas.map((o) => o.preco);
  const porMercado = ofertas.map((o) => {
    const hist = consultar('SELECT preco, registrado_em FROM historico_precos WHERE produto_id = ? AND mercado_id = ? ORDER BY registrado_em', produtoId, o.mercado_id);
    const t0 = hist.length ? new Date(hist[0].registrado_em).getTime() : 0;
    const dias = hist.map((h) => (new Date(h.registrado_em).getTime() - t0) / 86400000);
    const valores = hist.map((h) => h.preco);
    const reg = regressaoLinear(dias, valores);
    const resumo = resumoRegressao(reg, dias, valores, [7], 1);
    return {
      mercado_id: o.mercado_id,
      mercado: o.mercado,
      preco_atual: o.preco,
      desvio_da_media: arredonda(o.preco - media(precos), 2),
      historico: descritiva(valores, 2),
      tendencia: resumo && {
        reais_por_dia: resumo.inclinacao,
        r2: resumo.r2,
        significativa: resumo.significativa,
        previsao_7_dias: resumo.previsoes[0] ? resumo.previsoes[0].y : null,
        direcao: !resumo.significativa ? 'ESTAVEL' : resumo.inclinacao > 0 ? 'ALTA' : 'QUEDA',
        linha: resumo.linha,
      },
      serie: hist.map((h, i) => ({ dia: arredonda(dias[i], 3), t: h.registrado_em, v: h.preco })),
    };
  });
  return {
    produto,
    comparacao_atual: {
      descritiva: descritiva(precos, 2),
      intervalo_confianca_95: (() => { const ic = intervaloConfianca(precos); return ic ? { inferior: arredonda(ic.inferior, 2), superior: arredonda(ic.superior, 2) } : null; })(),
    },
    por_mercado: porMercado,
  };
}

export function indiceDePrecos() {
  const linhas = consultar(
    `SELECT pr.produto_id, pr.mercado_id, pr.preco, (SELECT MIN(preco) FROM precos x WHERE x.produto_id = pr.produto_id) AS menor
     FROM precos pr`,
  );
  const mercados = consultar('SELECT id, nome FROM mercados ORDER BY nome');
  return mercados.map((m) => {
    const dele = linhas.filter((l) => l.mercado_id === m.id);
    const razoes = dele.map((l) => l.preco / l.menor);
    return {
      mercado_id: m.id,
      mercado: m.nome,
      produtos: dele.length,
      indice_medio: arredonda(media(razoes), 4),
      desvio_padrao_indice: arredonda(descritiva(razoes).desvio_padrao, 4),
      vezes_mais_barato: dele.filter((l) => l.preco === l.menor).length,
    };
  }).sort((a, b) => a.indice_medio - b.indice_medio);
}

export const rotasEstatisticas = [
  {
    metodo: 'GET', caminho: '/api/estatisticas/dispositivos/:id', tag: 'Estatística', papeis: ['MERCADO', 'ADMIN'],
    resumo: 'Estatística descritiva, histograma, probabilidades, intervalo de confiança e regressão linear das leituras de um dispositivo',
    query: [['minutos', 'integer', 'Janela de análise em minutos (padrão 60, máx. 360)']],
    handler: ({ params, query, usuario }) => {
      const d = buscar('SELECT * FROM dispositivos WHERE id = ?', Number(params.id));
      if (!d) throw erro(404, 'Dispositivo não encontrado');
      exigirMercado(usuario, d.mercado_id);
      return estatisticasDispositivo(d, Math.min(Math.max(inteiro(query.minutos, 60), 5), 360));
    },
  },
  {
    metodo: 'GET', caminho: '/api/estatisticas/produtos/:id', tag: 'Estatística', resumo: 'Dispersão dos preços entre mercados e tendência (regressão) do histórico de cada mercado',
    handler: ({ params }) => estatisticasProduto(Number(params.id)),
  },
  {
    metodo: 'GET', caminho: '/api/estatisticas/mercados', tag: 'Estatística', resumo: 'Índice de preços: quanto cada mercado costuma custar acima do menor preço (1,00 = sempre o mais barato)',
    handler: () => indiceDePrecos(),
  },
];
