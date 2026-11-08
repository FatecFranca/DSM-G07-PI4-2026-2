import { Link, Rotas, ir, useRota } from './roteador.jsx';
import { useAuth, useCarrinho } from './contextos.jsx';
import Home from './paginas/Home.jsx';
import Busca from './paginas/Busca.jsx';
import Produto from './paginas/Produto.jsx';
import Carrinho from './paginas/Carrinho.jsx';
import Conta from './paginas/Conta.jsx';
import { Entrar, Cadastrar } from './paginas/Entrar.jsx';
import PainelMercado from './paginas/PainelMercado.jsx';
import Admin from './paginas/Admin.jsx';

const TABELA = [
  ['/', Home],
  ['/busca', Busca],
  ['/produto/:id', Produto],
  ['/carrinho', Carrinho],
  ['/conta', Conta],
  ['/entrar', Entrar],
  ['/cadastro', Cadastrar],
  ['/mercado', PainelMercado],
  ['/admin', Admin],
];

function Topo() {
  const { usuario, sair } = useAuth();
  const { quantidade } = useCarrinho();
  return (
    <header className="topo">
      <div className="container topo-conteudo">
        <Link para="/" className="logo">
          <span className="logo-marca">B</span>BAC
        </Link>
        <nav className="menu">
          <Link para="/busca">Buscar</Link>
          {usuario?.papel === 'MERCADO' && <Link para="/mercado">Painel IoT</Link>}
          {usuario?.papel === 'ADMIN' && <Link para="/mercado">Painel IoT</Link>}
          {usuario?.papel === 'ADMIN' && <Link para="/admin">Admin</Link>}
          <Link para="/carrinho" className="menu-carrinho">
            🛒 <span className="oculta-mobile">Carrinho</span>
            {quantidade > 0 && <b className="contador">{quantidade}</b>}
          </Link>
          {usuario ? (
            <>
              <Link para="/conta">{usuario.nome.split(' ')[0]}</Link>
              <button
                className="botao botao-claro"
                onClick={() => {
                  sair();
                  ir('/');
                }}
              >
                Sair
              </button>
            </>
          ) : (
            <>
              <Link para="/entrar" className="botao botao-claro">
                Entrar
              </Link>
              <Link para="/cadastro" className="botao oculta-mobile">
                Cadastrar
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

export default function App() {
  const rota = useRota();
  return (
    <>
      <Topo />
      <main className="container conteudo">
        <Rotas
          tabela={TABELA}
          rota={rota}
          naoEncontrada={
            <div className="vazio">
              <h2>Página não encontrada</h2>
              <Link para="/">Voltar ao início</Link>
            </div>
          }
        />
      </main>
      <footer className="rodape">
        <div className="container">
          BAC · Comparador de preços de supermercados com IoT · PI 4º semestre DSM – FATEC Franca ·{' '}
          <a href="/api/docs" target="_blank" rel="noreferrer">
            Documentação da API (OpenAPI)
          </a>
        </div>
      </footer>
    </>
  );
}
