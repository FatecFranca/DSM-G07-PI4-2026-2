import { useState } from 'react';
import { Link, ir } from '../roteador.jsx';
import { useAuth } from '../contextos.jsx';
import { MensagemErro } from '../componentes.jsx';

const DEMO = [
  ['Consumidor', 'user@gmail.com', 'user123'],
  ['Supermercado', 'savegnago@market.com', 'market123'],
  ['Administrador', 'admin@bac.com', 'admin123'],
];

function destino(usuario) {
  if (usuario.papel === 'ADMIN') return '/admin';
  if (usuario.papel === 'MERCADO') return '/mercado';
  return '/';
}

export function Entrar() {
  const { entrar } = useAuth();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  const enviar = async (e) => {
    e.preventDefault();
    setEnviando(true);
    setErro('');
    try {
      ir(destino(await entrar(email, senha)));
    } catch (err) {
      setErro(err.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="formulario-pagina">
      <form className="formulario" onSubmit={enviar}>
        <h1>Entrar</h1>
        <MensagemErro erro={erro} />
        <label>
          E-mail
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="username" />
        </label>
        <label>
          Senha
          <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} required autoComplete="current-password" />
        </label>
        <button className="botao" disabled={enviando}>
          {enviando ? 'Entrando...' : 'Entrar'}
        </button>
        <p className="centro">
          Não tem conta? <Link para="/cadastro">Cadastre-se</Link>
        </p>
        <div className="demo">
          <small>Contas de demonstração (clique para preencher):</small>
          {DEMO.map(([rotulo, e, s]) => (
            <button
              type="button"
              key={e}
              className="botao botao-claro"
              onClick={() => {
                setEmail(e);
                setSenha(s);
              }}
            >
              {rotulo}
            </button>
          ))}
        </div>
      </form>
    </div>
  );
}

export function Cadastrar() {
  const { cadastrar } = useAuth();
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');

  const enviar = async (e) => {
    e.preventDefault();
    setErro('');
    try {
      await cadastrar(nome, email, senha);
      ir('/');
    } catch (err) {
      setErro(err.message);
    }
  };

  return (
    <div className="formulario-pagina">
      <form className="formulario" onSubmit={enviar}>
        <h1>Criar conta</h1>
        <MensagemErro erro={erro} />
        <label>
          Nome
          <input value={nome} onChange={(e) => setNome(e.target.value)} required minLength={2} />
        </label>
        <label>
          E-mail
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          Senha (mínimo 6 caracteres)
          <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} required minLength={6} />
        </label>
        <button className="botao">Cadastrar</button>
        <p className="centro">
          Já tem conta? <Link para="/entrar">Entrar</Link>
        </p>
      </form>
    </div>
  );
}
