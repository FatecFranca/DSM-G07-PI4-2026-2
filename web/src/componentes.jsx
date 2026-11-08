import { useEffect, useState } from 'react';
import { Link, ir } from './roteador.jsx';
import { moeda } from './formatos.js';
import { useAuth, useCarrinho } from './contextos.jsx';
import { api } from './api.js';

export function Imagem({ src, alt, icone = '📦', className = '' }) {
  const [falhou, setFalhou] = useState(false);
  if (!src || falhou) {
    return (
      <div className={`imagem-vazia ${className}`} aria-label={alt}>
        <span>{icone}</span>
      </div>
    );
  }
  return <img src={src} alt={alt} className={className} loading="lazy" onError={() => setFalhou(true)} />;
}

export const Selo = ({ tipo = 'neutro', children }) => <span className={`selo selo-${tipo}`}>{children}</span>;

export const Carregando = ({ texto = 'Carregando...' }) => <div className="vazio">{texto}</div>;

export const MensagemErro = ({ erro }) => (erro ? <div className="aviso aviso-erro">{erro}</div> : null);

export function Cartao({ titulo, valor, detalhe, tipo }) {
  return (
    <div className={`cartao-kpi ${tipo ? `kpi-${tipo}` : ''}`}>
      <span className="kpi-titulo">{titulo}</span>
      <strong className="kpi-valor">{valor}</strong>
      {detalhe && <span className="kpi-detalhe">{detalhe}</span>}
    </div>
  );
}

export function Abas({ abas, ativa, aoMudar }) {
  return (
    <div className="abas" role="tablist">
      {abas.map(([id, rotulo]) => (
        <button key={id} role="tab" aria-selected={ativa === id} className={ativa === id ? 'ativa' : ''} onClick={() => aoMudar(id)}>
          {rotulo}
        </button>
      ))}
    </div>
  );
}

export const rotuloEstoque = (estoque) => (estoque <= 0 ? 'Indisponível' : estoque <= 5 ? `Últimas ${estoque} un.` : 'Em estoque');
export const tipoEstoque = (estoque) => (estoque <= 0 ? 'erro' : estoque <= 5 ? 'alerta' : 'ok');

export function BotaoFavorito({ produtoId, inicial = false, aoMudar }) {
  const { usuario } = useAuth();
  const [favorito, setFavorito] = useState(inicial);
  if (!usuario) return null;
  const alternar = async (e) => {
    e.preventDefault();
    const novo = !favorito;
    setFavorito(novo);
    try {
      if (novo) await api.put(`/favoritos/${produtoId}`);
      else await api.del(`/favoritos/${produtoId}`);
      aoMudar?.(novo);
    } catch {
      setFavorito(!novo);
    }
  };
  return (
    <button className={`favorito ${favorito ? 'ativo' : ''}`} onClick={alternar} title={favorito ? 'Remover dos favoritos' : 'Avisar quando o preço cair'} aria-pressed={favorito}>
      {favorito ? '♥' : '♡'}
    </button>
  );
}

export function ProdutoCard({ produto }) {
  const { adicionar } = useCarrinho();
  const [adicionado, setAdicionado] = useState(false);
  const melhor = produto.ofertas.find((o) => o.melhor);
  const clicar = () => {
    adicionar(produto);
    setAdicionado(true);
    setTimeout(() => setAdicionado(false), 1200);
  };
  return (
    <article className="produto-card">
      <Link para={`/produto/${produto.id}`} className="produto-img">
        <Imagem src={produto.imagem_url} alt={produto.nome} icone={produto.icone} />
        {produto.economia > 0 && produto.ofertas.length > 1 && <span className="faixa-economia">Economize {moeda(produto.economia)}</span>}
      </Link>
      <div className="produto-corpo">
        <span className="categoria-nome">{produto.categoria}</span>
        <Link para={`/produto/${produto.id}`} className="produto-nome">
          {produto.nome}
        </Link>
        <ul className="ofertas">
          {produto.ofertas.slice(0, 5).map((o) => (
            <li key={o.mercado_id} className={o.melhor ? 'melhor' : o.disponivel ? '' : 'indisponivel'}>
              <span>{o.mercado}</span>
              <span className="oferta-preco">
                {o.disponivel ? moeda(o.preco) : 'sem estoque'}
                {o.melhor && <b title="Melhor preço">🏆</b>}
              </span>
            </li>
          ))}
        </ul>
        <div className="produto-rodape">
          <div>
            <small>{melhor ? `Melhor preço no ${melhor.mercado}` : 'Sem estoque no momento'}</small>
            <strong className="preco-destaque">{melhor ? moeda(melhor.preco) : '—'}</strong>
          </div>
          <button className="botao botao-icone" onClick={clicar} disabled={!melhor} title="Adicionar ao carrinho">
            {adicionado ? '✓' : '🛒'}
          </button>
        </div>
      </div>
    </article>
  );
}

export function Protegido({ papeis, children }) {
  const { usuario, carregando } = useAuth();
  useEffect(() => {
    if (!carregando && !usuario) ir('/entrar');
  }, [carregando, usuario]);
  if (carregando || !usuario) return <Carregando />;
  if (papeis && !papeis.includes(usuario.papel)) return <div className="aviso aviso-erro">Você não tem permissão para acessar esta página.</div>;
  return children;
}
