import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Link, ir } from '../roteador.jsx';
import { useAuth, useCarrinho } from '../contextos.jsx';
import { Imagem, MensagemErro } from '../componentes.jsx';
import ResultadoComparacao from './ResultadoComparacao.jsx';

export default function Carrinho() {
  const { itens, alterar, remover, limpar, quantidade } = useCarrinho();
  const { usuario } = useAuth();
  const [resultado, setResultado] = useState(null);
  const [erro, setErro] = useState('');
  const [nomeLista, setNomeLista] = useState('');
  const [aviso, setAviso] = useState('');

  useEffect(() => {
    if (!itens.length) {
      setResultado(null);
      return undefined;
    }
    let ativo = true;
    const espera = setTimeout(() => {
      api.post('/comparar', { itens: itens.map((i) => ({ produto_id: i.id, quantidade: i.quantidade })) })
        .then((r) => ativo && (setResultado(r), setErro('')))
        .catch((e) => ativo && setErro(e.message));
    }, 250);
    return () => {
      ativo = false;
      clearTimeout(espera);
    };
  }, [itens]);

  const salvar = async () => {
    if (!usuario) return ir('/entrar');
    try {
      const nome = nomeLista.trim() || `Lista de ${new Date().toLocaleDateString('pt-BR')}`;
      await api.post('/listas', { nome, itens: itens.map((i) => ({ produto_id: i.id, quantidade: i.quantidade })) });
      setAviso(`Lista "${nome}" salva em Minha conta.`);
      setNomeLista('');
    } catch (e) {
      setErro(e.message);
    }
  };

  if (!itens.length) {
    return (
      <div className="vazio grande">
        <div className="vazio-icone">🛒</div>
        <h2>Seu carrinho está vazio</h2>
        <p>Adicione produtos para descobrir em qual mercado a compra fica mais barata.</p>
        <Link para="/busca" className="botao">
          Buscar produtos
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="linha-titulo">
        <h1>Carrinho ({quantidade} {quantidade === 1 ? 'item' : 'itens'})</h1>
        <button className="botao botao-claro" onClick={limpar}>
          Limpar tudo
        </button>
      </div>
      <MensagemErro erro={erro} />
      {aviso && <div className="aviso aviso-ok">{aviso}</div>}

      <div className="lista-carrinho">
        {itens.map((i) => (
          <div key={i.id} className="item-carrinho">
            <Imagem src={i.imagem_url} alt={i.nome} icone={i.icone} className="miniatura" />
            <Link para={`/produto/${i.id}`} className="item-nome">
              {i.nome}
            </Link>
            <div className="quantidade">
              <button aria-label="Diminuir" onClick={() => alterar(i.id, -1)}>
                −
              </button>
              <span>{i.quantidade}</span>
              <button aria-label="Aumentar" onClick={() => alterar(i.id, 1)}>
                +
              </button>
            </div>
            <button className="botao-remover" onClick={() => remover(i.id)} aria-label="Remover">
              ✕
            </button>
          </div>
        ))}
      </div>

      <h2>Comparação entre supermercados</h2>
      {resultado ? <ResultadoComparacao r={resultado} /> : <div className="vazio">Calculando...</div>}

      <div className="salvar-lista">
        <input value={nomeLista} onChange={(e) => setNomeLista(e.target.value)} placeholder="Nome da lista (opcional)" />
        <button className="botao" onClick={salvar}>
          {usuario ? 'Salvar como lista' : 'Entrar para salvar a lista'}
        </button>
      </div>
    </div>
  );
}
