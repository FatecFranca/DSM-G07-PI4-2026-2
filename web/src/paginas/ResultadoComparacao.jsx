import { moeda, pct } from '../formatos.js';
import { Selo } from '../componentes.jsx';

export default function ResultadoComparacao({ r }) {
  if (!r.ranking.length) return <div className="vazio">Nenhum mercado possui estes produtos em estoque.</div>;
  const melhor = r.melhor_mercado;
  const combinacao = r.combinacao_otima;
  return (
    <div className="comparacao">
      <div className="comparacao-topo">
        <div className="destaque-mercado">
          <span className="rotulo-claro">🏆 Melhor mercado para esta lista</span>
          <h3>{melhor.mercado}</h3>
          <strong>{moeda(melhor.total)}</strong>
          <small>
            {melhor.disponiveis} de {melhor.total_itens} itens disponíveis ({pct(melhor.cobertura, 0)})
          </small>
        </div>
        <div className="economia-box">
          {r.economia_vs_mais_caro > 0 ? (
            <>
              <span>Economia em relação ao mercado mais caro</span>
              <strong>{moeda(r.economia_vs_mais_caro)}</strong>
              <small>e {moeda(r.economia_vs_segundo)} em relação ao 2º colocado</small>
            </>
          ) : (
            <span>Apenas um mercado possui todos os itens em estoque.</span>
          )}
          {combinacao.economia_vs_melhor_mercado > 0 && (
            <small className="dica">
              💡 Comprando cada item no mercado mais barato (em {new Set(combinacao.itens.map((i) => i.mercado_id)).size} mercados) o total cai para <b>{moeda(combinacao.total)}</b>.
            </small>
          )}
        </div>
      </div>

      <table className="tabela">
        <thead>
          <tr>
            <th>#</th>
            <th>Mercado</th>
            <th>Total</th>
            <th>Itens</th>
            <th>Situação</th>
          </tr>
        </thead>
        <tbody>
          {r.ranking.map((m, i) => (
            <tr key={m.mercado_id} className={i === 0 ? 'linha-melhor' : ''}>
              <td>{i + 1}º</td>
              <td>{m.mercado}</td>
              <td>
                <b>{moeda(m.total)}</b>
              </td>
              <td>
                {m.disponiveis}/{m.total_itens}
              </td>
              <td>{m.completo ? <Selo tipo="ok">Lista completa</Selo> : <Selo tipo="alerta">Faltam: {m.faltantes.join(', ')}</Selo>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
