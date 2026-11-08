import { useEffect, useState } from 'react';
import { api, montarQuery } from '../api.js';
import { ir } from '../roteador.jsx';
import { useCarregar } from '../contextos.jsx';
import { Carregando, MensagemErro, ProdutoCard } from '../componentes.jsx';
import { moeda } from '../formatos.js';

export default function Busca({ query }) {
  const [q, setQ] = useState(query.get('q') || '');
  const categoria = query.get('categoria') || '';
  const mercado = query.get('mercado') || '';
  const ordem = query.get('ordem') || 'preco';
  const [max, setMax] = useState('');

  useEffect(() => setQ(query.get('q') || ''), [query]);

  const categorias = useCarregar(() => api.get('/categorias'), []);
  const mercados = useCarregar(() => api.get('/mercados'), []);
  const termo = query.get('q') || '';
  const resultado = useCarregar(() => api.get(`/produtos${montarQuery({ q: termo, categoria, mercado, ordem, max, limite: 60 })}`), [termo, categoria, mercado, ordem, max]);

  const atualizar = (mudancas) => {
    const p = new URLSearchParams(query);
    for (const [k, v] of Object.entries(mudancas)) v ? p.set(k, v) : p.delete(k);
    ir(`/busca?${p.toString()}`);
  };

  return (
    <div className="busca-layout">
      <aside className="filtros">
        <h3>Filtrar resultados</h3>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            atualizar({ q: q.trim() });
          }}
        >
          <label>
            Produto
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ex.: arroz" />
          </label>
        </form>
        <label>
          Categoria
          <select value={categoria} onChange={(e) => atualizar({ categoria: e.target.value })}>
            <option value="">Todas</option>
            {categorias.dados?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.icone} {c.nome}
              </option>
            ))}
          </select>
        </label>
        <label>
          Supermercado
          <select value={mercado} onChange={(e) => atualizar({ mercado: e.target.value })}>
            <option value="">Todos</option>
            {mercados.dados?.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nome}
              </option>
            ))}
          </select>
        </label>
        <label>
          Ordenar por
          <select value={ordem} onChange={(e) => atualizar({ ordem: e.target.value })}>
            <option value="preco">Menor preço</option>
            <option value="economia">Maior economia</option>
            <option value="nome">Nome (A–Z)</option>
          </select>
        </label>
        <label>
          Preço máximo: <b>{max ? moeda(Number(max)) : 'sem limite'}</b>
          <input type="range" min="0" max="100" step="1" value={max || 100} onChange={(e) => setMax(Number(e.target.value) >= 100 ? '' : e.target.value)} />
        </label>
        <p className="subtitulo">
          <b>{resultado.dados?.total ?? 0}</b> produto(s) encontrado(s)
        </p>
      </aside>
      <section>
        <h2>{termo ? `Resultados para "${termo}"` : 'Todos os produtos'}</h2>
        <MensagemErro erro={resultado.erro} />
        {resultado.carregando && !resultado.dados ? (
          <Carregando texto="Buscando produtos..." />
        ) : resultado.dados?.produtos.length ? (
          <div className="grade-produtos">
            {resultado.dados.produtos.map((p) => (
              <ProdutoCard key={p.id} produto={p} />
            ))}
          </div>
        ) : (
          <div className="vazio">Nenhum produto encontrado com estes filtros.</div>
        )}
      </section>
    </div>
  );
}
