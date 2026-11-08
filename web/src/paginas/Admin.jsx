import { useState } from 'react';
import { api } from '../api.js';
import { useAuth, useCarregar } from '../contextos.jsx';
import { Cartao, Carregando, MensagemErro, Protegido, Selo } from '../componentes.jsx';
import { Barras } from '../graficos.jsx';
import { dataHora, numero } from '../formatos.js';

function AdminConteudo() {
  const { usuario } = useAuth();
  const metricas = useCarregar(() => api.get('/admin/metricas'), [], 10000);
  const usuarios = useCarregar(() => api.get('/admin/usuarios'), []);
  const mercados = useCarregar(() => api.get('/mercados'), []);
  const indice = useCarregar(() => api.get('/estatisticas/mercados'), []);
  const [erro, setErro] = useState('');
  const [categoria, setCategoria] = useState('');
  const [msg, setMsg] = useState('');

  const mudarPapel = async (u, papel) => {
    try {
      await api.put(`/admin/usuarios/${u.id}`, { papel, mercado_id: papel === 'MERCADO' ? u.mercado_id || mercados.dados[0].id : undefined });
      setErro('');
      usuarios.recarregar();
    } catch (e) {
      setErro(e.message);
    }
  };
  const excluir = async (u) => {
    try {
      await api.del(`/admin/usuarios/${u.id}`);
      setErro('');
      usuarios.recarregar();
      metricas.recarregar();
    } catch (e) {
      setErro(e.message);
    }
  };
  const criarCategoria = async (e) => {
    e.preventDefault();
    try {
      await api.post('/admin/categorias', { nome: categoria });
      setMsg(`Categoria "${categoria}" criada.`);
      setCategoria('');
      setErro('');
      metricas.recarregar();
    } catch (err) {
      setErro(err.message);
    }
  };

  const m = metricas.dados;
  return (
    <div>
      <span className="categoria-nome">Controle do sistema</span>
      <h1>Painel administrativo</h1>
      {!m ? <Carregando /> : (
        <div className="grade-kpi">
          <Cartao titulo="Usuários" valor={m.usuarios} />
          <Cartao titulo="Supermercados" valor={m.mercados} />
          <Cartao titulo="Produtos" valor={m.produtos} detalhe={`${m.ofertas} ofertas`} />
          <Cartao titulo="Dispositivos IoT" valor={m.dispositivos} detalhe={`${numero(m.leituras, 0)} leituras`} />
          <Cartao titulo="Alertas abertos" valor={m.alertas_abertos} tipo={m.alertas_abertos ? 'erro' : 'ok'} />
        </div>
      )}
      <MensagemErro erro={erro} />
      {msg && <div className="aviso aviso-ok">{msg}</div>}

      <section className="secao duas-colunas">
        <div>
          <h2>Produtos por categoria</h2>
          {m && <Barras destaqueMenor={false} itens={m.produtos_por_categoria.map((c) => ({ rotulo: c.categoria, valor: c.total }))} formato={(v) => v} />}
          <form className="linha-form" onSubmit={criarCategoria}>
            <input value={categoria} onChange={(e) => setCategoria(e.target.value)} placeholder="Nova categoria" required minLength={2} />
            <button className="botao">Criar</button>
          </form>
        </div>
        <div>
          <h2>Índice de preços por mercado</h2>
          <p className="subtitulo">Média de (preço ÷ menor preço do produto). Quanto mais perto de 1,00, mais barato.</p>
          {indice.dados && (
            <table className="tabela">
              <thead><tr><th>Mercado</th><th>Índice</th><th>Desvio</th><th>Menor preço em</th></tr></thead>
              <tbody>
                {indice.dados.map((i) => (
                  <tr key={i.mercado_id}><td>{i.mercado}</td><td><b>{numero(i.indice_medio, 3)}</b></td><td>{numero(i.desvio_padrao_indice, 3)}</td><td>{i.vezes_mais_barato}/{i.produtos}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section className="secao">
        <h2>Usuários</h2>
        <div className="tabela-rolagem">
          <table className="tabela">
            <thead><tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Criado em</th><th /></tr></thead>
            <tbody>
              {usuarios.dados?.map((u) => (
                <tr key={u.id}>
                  <td>{u.nome}</td>
                  <td>{u.email}</td>
                  <td>
                    <select value={u.papel} disabled={u.id === usuario.id} onChange={(e) => mudarPapel(u, e.target.value)} aria-label={`Perfil de ${u.nome}`}>
                      <option value="USUARIO">Consumidor</option>
                      <option value="MERCADO">Supermercado</option>
                      <option value="ADMIN">Administrador</option>
                    </select>{' '}
                    {u.mercado_id && <Selo>mercado {u.mercado_id}</Selo>}
                  </td>
                  <td>{dataHora(u.criado_em)}</td>
                  <td><button className="botao botao-claro pequeno" disabled={u.id === usuario.id} onClick={() => excluir(u)}>Excluir</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default function Admin() {
  return (
    <Protegido papeis={['ADMIN']}>
      <AdminConteudo />
    </Protegido>
  );
}
