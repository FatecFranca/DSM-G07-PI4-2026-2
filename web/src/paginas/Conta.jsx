import { useState } from 'react';
import { api } from '../api.js';
import { Link } from '../roteador.jsx';
import { useAuth, useCarregar } from '../contextos.jsx';
import { Abas, Carregando, MensagemErro, Protegido, Selo } from '../componentes.jsx';
import { dataHora, moeda } from '../formatos.js';
import ResultadoComparacao from './ResultadoComparacao.jsx';

function Listas() {
  const listas = useCarregar(() => api.get('/listas'), []);
  const [resultado, setResultado] = useState(null);
  const [erro, setErro] = useState('');

  const otimizar = async (id) => {
    setErro('');
    try {
      setResultado(await api.get(`/listas/${id}/otimizar`));
    } catch (e) {
      setErro(e.message);
    }
  };
  const excluir = async (id) => {
    await api.del(`/listas/${id}`);
    if (resultado?.lista.id === id) setResultado(null);
    listas.recarregar();
  };

  if (!listas.dados) return <Carregando />;
  if (!listas.dados.length) return <div className="vazio">Nenhuma lista salva. Monte seu carrinho e salve como lista.</div>;
  return (
    <>
      <MensagemErro erro={erro} />
      <div className="grade-listas">
        {listas.dados.map((l) => (
          <div key={l.id} className="cartao-lista">
            <div>
              <strong>{l.nome}</strong>
              <small>
                {l.itens.length} produto(s) · {dataHora(l.criada_em)}
              </small>
              <ul>{l.itens.slice(0, 4).map((i) => <li key={i.produto_id}>{i.quantidade}× {i.nome}</li>)}</ul>
            </div>
            <div className="acoes">
              <button className="botao" onClick={() => otimizar(l.id)}>
                ⚡ Otimizar
              </button>
              <button className="botao botao-claro" onClick={() => excluir(l.id)}>
                Excluir
              </button>
            </div>
          </div>
        ))}
      </div>
      {resultado && (
        <>
          <h2>Resultado: {resultado.lista.nome}</h2>
          <ResultadoComparacao r={resultado} />
        </>
      )}
    </>
  );
}

function Favoritos() {
  const favoritos = useCarregar(() => api.get('/favoritos'), []);
  if (!favoritos.dados) return <Carregando />;
  if (!favoritos.dados.length) return <div className="vazio">Você ainda não favoritou produtos. Toque no ♡ na página do produto para ser avisado quando o preço cair.</div>;
  return (
    <ul className="lista-simples">
      {favoritos.dados.map((f) => (
        <li key={f.id}>
          <Link para={`/produto/${f.id}`}>{f.nome}</Link>
          <span>a partir de {moeda(f.menor_preco)}</span>
          <button
            className="botao botao-claro"
            onClick={async () => {
              await api.del(`/favoritos/${f.id}`);
              favoritos.recarregar();
            }}
          >
            Remover
          </button>
        </li>
      ))}
    </ul>
  );
}

function Notificacoes() {
  const notificacoes = useCarregar(() => api.get('/notificacoes'), [], 10000);
  if (!notificacoes.dados) return <Carregando />;
  return (
    <>
      <div className="acoes">
        <button
          className="botao botao-claro"
          onClick={async () => {
            await api.post('/notificacoes/lidas');
            notificacoes.recarregar();
          }}
        >
          Marcar todas como lidas
        </button>
      </div>
      {notificacoes.dados.length === 0 ? (
        <div className="vazio">Sem notificações.</div>
      ) : (
        <ul className="lista-simples">
          {notificacoes.dados.map((n) => (
            <li key={n.id} className={n.lida ? '' : 'nao-lida'}>
              <Selo tipo={n.tipo === 'ALERTA_IOT' ? 'erro' : 'ok'}>{n.tipo === 'ALERTA_IOT' ? 'Alerta IoT' : 'Preço'}</Selo>
              <span>{n.mensagem}</span>
              <small>{dataHora(n.criada_em)}</small>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function ContaConteudo() {
  const { usuario } = useAuth();
  const [aba, setAba] = useState('listas');
  return (
    <div>
      <h1>Minha conta</h1>
      <p className="subtitulo">
        {usuario.nome} · {usuario.email} · <Selo>{usuario.papel}</Selo>
      </p>
      <Abas abas={[['listas', 'Listas'], ['favoritos', 'Favoritos'], ['notificacoes', 'Notificações']]} ativa={aba} aoMudar={setAba} />
      {aba === 'listas' && <Listas />}
      {aba === 'favoritos' && <Favoritos />}
      {aba === 'notificacoes' && <Notificacoes />}
    </div>
  );
}

export default function Conta() {
  return (
    <Protegido>
      <ContaConteudo />
    </Protegido>
  );
}
