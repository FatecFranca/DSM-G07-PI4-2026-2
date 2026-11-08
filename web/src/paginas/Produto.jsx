import { api } from '../api.js';
import { useCarregar, useCarrinho } from '../contextos.jsx';
import { Link } from '../roteador.jsx';
import { BotaoFavorito, Cartao, Carregando, Imagem, MensagemErro, Selo, rotuloEstoque, tipoEstoque } from '../componentes.jsx';
import { Barras, CORES, GraficoLinha } from '../graficos.jsx';
import { dataCurta, moeda, numero } from '../formatos.js';

const DIRECAO = { ALTA: ['erro', '↑ em alta'], QUEDA: ['ok', '↓ em queda'], ESTAVEL: ['neutro', '→ estável'] };

export default function Produto({ params }) {
  const { adicionar } = useCarrinho();
  const produto = useCarregar(() => api.get(`/produtos/${params.id}`), [params.id], 20000);
  const stats = useCarregar(() => api.get(`/estatisticas/produtos/${params.id}`), [params.id]);

  if (produto.erro && !produto.dados) return <MensagemErro erro={produto.erro} />;
  if (!produto.dados) return <Carregando />;
  const p = produto.dados;
  const melhor = p.ofertas.find((o) => o.melhor);

  const mercadosHist = [...new Set(p.historico.map((h) => h.mercado))];
  const series = mercadosHist.map((nome, i) => {
    const pontos = p.historico.filter((h) => h.mercado === nome).map((h) => ({ x: new Date(h.registrado_em).getTime(), y: h.preco }));
    return { nome, cor: CORES[i % CORES.length], pontos };
  });
  const d = stats.dados?.comparacao_atual.descritiva;
  const ic = stats.dados?.comparacao_atual.intervalo_confianca_95;

  return (
    <div className="produto-pagina">
      <Link para="/busca" className="voltar">
        ← Voltar à busca
      </Link>
      <div className="produto-topo">
        <Imagem src={p.imagem_url} alt={p.nome} icone={p.icone} className="produto-foto" />
        <div>
          <span className="categoria-nome">{p.categoria}</span>
          <h1>{p.nome}</h1>
          {melhor ? (
            <p className="subtitulo">
              Melhor preço: <strong className="preco-destaque">{moeda(melhor.preco)}</strong> no {melhor.mercado}
              {p.economia > 0 && <> · economia de até {moeda(p.economia)}</>}
            </p>
          ) : (
            <p className="subtitulo">Sem estoque nos mercados no momento.</p>
          )}
          <div className="acoes">
            <button className="botao" disabled={!melhor} onClick={() => adicionar({ id: p.id, nome: p.nome, imagem_url: p.imagem_url, icone: p.icone })}>
              🛒 Adicionar ao carrinho
            </button>
            <BotaoFavorito produtoId={p.id} inicial={p.favorito} />
          </div>
        </div>
      </div>

      <section className="secao duas-colunas">
        <div>
          <h2>Preço em cada supermercado</h2>
          <Barras itens={p.ofertas.filter((o) => o.disponivel).map((o) => ({ rotulo: o.mercado, valor: o.preco }))} formato={moeda} />
          <table className="tabela">
            <thead>
              <tr>
                <th>Mercado</th>
                <th>Preço</th>
                <th>Estoque (IoT/PDV)</th>
              </tr>
            </thead>
            <tbody>
              {p.ofertas.map((o) => (
                <tr key={o.mercado_id}>
                  <td>{o.mercado}</td>
                  <td>
                    <b>{moeda(o.preco)}</b> {o.melhor && '🏆'}
                  </td>
                  <td>
                    <Selo tipo={tipoEstoque(o.estoque)}>{rotuloEstoque(o.estoque)}</Selo>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <h2>Histórico de preços (30 dias)</h2>
          <GraficoLinha series={series} formatoX={(x) => dataCurta(new Date(x).toISOString())} formatoY={(y) => moeda(y)} />
        </div>
      </section>

      <section className="secao">
        <h2>Análise estatística dos preços</h2>
        {stats.dados && d ? (
          <>
            <div className="grade-kpi">
              <Cartao titulo="Média entre mercados" valor={moeda(d.media)} />
              <Cartao titulo="Mediana" valor={moeda(d.mediana)} />
              <Cartao titulo="Desvio padrão" valor={moeda(d.desvio_padrao)} detalhe={`CV ${numero((d.coeficiente_variacao || 0) * 100, 1)}%`} />
              <Cartao titulo="Amplitude" valor={moeda(d.amplitude)} detalhe={`${moeda(d.minimo)} a ${moeda(d.maximo)}`} />
              <Cartao titulo="Assimetria" valor={numero(d.assimetria)} detalhe={d.assimetria > 0.5 ? 'poucos mercados caros' : d.assimetria < -0.5 ? 'poucos mercados baratos' : 'distribuição simétrica'} />
              <Cartao titulo="IC 95% da média" valor={ic ? `${moeda(ic.inferior)} – ${moeda(ic.superior)}` : '—'} />
            </div>
            <h3>Tendência por mercado (regressão linear do histórico)</h3>
            <table className="tabela">
              <thead>
                <tr>
                  <th>Mercado</th>
                  <th>Preço atual</th>
                  <th>Tendência (R$/dia)</th>
                  <th>R²</th>
                  <th>Direção</th>
                  <th>Previsão em 7 dias</th>
                </tr>
              </thead>
              <tbody>
                {stats.dados.por_mercado.map((m) => (
                  <tr key={m.mercado_id}>
                    <td>{m.mercado}</td>
                    <td>{moeda(m.preco_atual)}</td>
                    <td>{m.tendencia ? numero(m.tendencia.reais_por_dia, 4) : '—'}</td>
                    <td>{m.tendencia ? numero(m.tendencia.r2, 3) : '—'}</td>
                    <td>{m.tendencia && <Selo tipo={DIRECAO[m.tendencia.direcao][0]}>{DIRECAO[m.tendencia.direcao][1]}</Selo>}</td>
                    <td>{m.tendencia ? moeda(m.tendencia.previsao_7_dias) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : (
          <Carregando />
        )}
      </section>
    </div>
  );
}
