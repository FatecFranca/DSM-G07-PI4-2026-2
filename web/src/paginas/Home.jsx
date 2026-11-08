import { useState } from 'react';
import { api } from '../api.js';
import { Link, ir } from '../roteador.jsx';
import { useCarregar } from '../contextos.jsx';
import { Carregando, MensagemErro, ProdutoCard, Selo } from '../componentes.jsx';
import { Barras } from '../graficos.jsx';
import { numero } from '../formatos.js';

const CADEIA = {
  OK: ['ok', 'Cadeia fria OK'],
  ALERTA: ['erro', 'Alerta de temperatura'],
  SEM_DADOS: ['neutro', 'Sem dados dos sensores'],
};

export default function Home() {
  const [busca, setBusca] = useState('');
  const destaques = useCarregar(() => api.get('/produtos?ordem=economia&limite=8'), []);
  const mercados = useCarregar(() => api.get('/mercados'), [], 15000);
  const categorias = useCarregar(() => api.get('/categorias'), []);
  const indice = useCarregar(() => api.get('/estatisticas/mercados'), []);

  const pesquisar = (e) => {
    e.preventDefault();
    ir(`/busca?q=${encodeURIComponent(busca.trim())}`);
  };

  return (
    <>
      <section className="heroi">
        <h1>Economia inteligente de verdade</h1>
        <p>Compare os preços dos supermercados da sua região, veja o que está em estoque agora e descubra onde sua lista fica mais barata.</p>
        <form onSubmit={pesquisar} className="busca-heroi">
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="O que você procura hoje? Arroz, leite, café..." aria-label="Buscar produtos" />
          <button className="botao">Pesquisar</button>
        </form>
      </section>

      <section className="secao">
        <h2>Maiores diferenças de preço</h2>
        <p className="subtitulo">Produtos em que escolher o mercado certo faz mais diferença.</p>
        <MensagemErro erro={destaques.erro} />
        {destaques.carregando && !destaques.dados ? <Carregando /> : <div className="grade-produtos">{destaques.dados?.produtos.map((p) => <ProdutoCard key={p.id} produto={p} />)}</div>}
      </section>

      <section className="secao duas-colunas">
        <div>
          <h2>Supermercados</h2>
          <p className="subtitulo">Status da cadeia fria monitorado por sensores IoT em tempo real.</p>
          <div className="lista-mercados">
            {mercados.dados?.map((m) => (
              <Link key={m.id} para={`/busca?mercado=${m.id}`} className="mercado-linha">
                <div>
                  <strong>{m.nome}</strong>
                  <small>{m.endereco}</small>
                </div>
                <Selo tipo={CADEIA[m.cadeia_fria][0]}>❄️ {CADEIA[m.cadeia_fria][1]}</Selo>
              </Link>
            ))}
          </div>
        </div>
        <div>
          <h2>Quem costuma ser mais barato?</h2>
          <p className="subtitulo">Índice médio de preço (1,00 = sempre o menor preço do produto).</p>
          {indice.dados && <Barras itens={indice.dados.map((m) => ({ rotulo: m.mercado, valor: m.indice_medio }))} formato={(v) => numero(v, 3)} />}
        </div>
      </section>

      <section className="secao">
        <h2>Categorias</h2>
        <div className="grade-categorias">
          {categorias.dados?.map((c) => (
            <Link key={c.id} para={`/busca?categoria=${c.id}`} className="categoria">
              <span>{c.icone}</span>
              {c.nome}
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
