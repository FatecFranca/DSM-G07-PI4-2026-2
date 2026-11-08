import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth, useCarregar } from '../contextos.jsx';
import { Abas, Cartao, Carregando, MensagemErro, Protegido, Selo } from '../componentes.jsx';
import { GraficoLinha, Histograma, Spark } from '../graficos.jsx';
import { dataHora, hora, moeda, numero, pct } from '../formatos.js';

const foraDoLimite = (d) => d.ultimo_valor !== null && ((d.limite_max !== null && d.ultimo_valor > d.limite_max) || (d.limite_min !== null && d.ultimo_valor < d.limite_min));

function textoValor(d) {
  if (d.ultimo_valor === null) return '—';
  if (d.tipo === 'PORTA') return d.ultimo_valor >= 0.5 ? 'Aberta' : 'Fechada';
  if (d.tipo === 'PRESENCA') return d.ultimo_valor >= 0.5 ? 'Detectada' : 'Livre';
  if (d.papel === 'ATUADOR') return d.estado ? 'Ligado' : 'Desligado';
  return `${numero(d.ultimo_valor, 1)} ${d.unidade}`;
}

function CartaoDispositivo({ d, selecionado, aoSelecionar, aoAcionar }) {
  const alerta = foraDoLimite(d);
  const atuador = d.papel === 'ATUADOR';
  return (
    <div className={`dispositivo ${alerta ? 'em-alerta' : ''} ${selecionado ? 'selecionado' : ''} ${d.online ? '' : 'offline'}`}>
      <div className="dispositivo-topo">
        <div>
          <strong>{d.nome}</strong>
          <small>{d.local}</small>
        </div>
        <Selo tipo={!d.online ? 'neutro' : alerta ? 'erro' : 'ok'}>{!d.online ? 'Offline' : alerta ? 'Alerta' : atuador ? 'Online' : 'Normal'}</Selo>
      </div>
      <div className="dispositivo-valor">
        <span className={atuador ? (d.estado ? 'ligado' : 'desligado') : ''}>{textoValor(d)}</span>
        {d.estoque_estimado !== null && <small>≈ {d.estoque_estimado} un. de {d.produto_nome}</small>}
      </div>
      {!atuador ? (
        <button className="spark-botao" onClick={() => aoSelecionar(d.id)} title="Ver no gráfico ao vivo">
          <Spark valores={d.serie.map((p) => p.v)} cor={alerta ? '#dc2626' : '#16a34a'} />
        </button>
      ) : (
        <div className="atuador-controles">
          <label className="chave" title="Ligar / desligar">
            <input type="checkbox" checked={!!d.estado} onChange={(e) => aoAcionar(d.id, { estado: e.target.checked })} aria-label={`Acionar ${d.nome}`} />
            <span />
          </label>
          <Selo tipo={d.modo === 'AUTO' ? 'ok' : 'alerta'}>{d.modo === 'AUTO' ? 'Automático' : 'Manual'}</Selo>
          {d.modo === 'MANUAL' && (
            <button className="botao botao-claro pequeno" onClick={() => aoAcionar(d.id, { modo: 'AUTO' })}>
              Voltar ao automático
            </button>
          )}
        </div>
      )}
      <small className="dispositivo-rodape">Última leitura: {hora(d.ultima_leitura_em)}</small>
    </div>
  );
}

function TempoReal({ mercadoId }) {
  const painel = useCarregar(() => api.get(`/iot/mercados/${mercadoId}/painel?pontos=90`), [mercadoId], 3000);
  const eventos = useCarregar(() => api.get(`/iot/mercados/${mercadoId}/eventos`), [mercadoId], 6000);
  const [selecionado, setSelecionado] = useState(null);
  const [erroAcao, setErroAcao] = useState('');

  if (painel.erro && !painel.dados) return <MensagemErro erro={painel.erro} />;
  if (!painel.dados) return <Carregando texto="Conectando aos sensores..." />;
  const { dispositivos, alertas, resumo } = painel.dados;
  const sensores = dispositivos.filter((d) => d.papel === 'SENSOR');
  const atual = sensores.find((d) => d.id === selecionado) || sensores[0];
  const abertos = alertas.filter((a) => !a.resolvido_em);

  const acionar = async (id, corpo) => {
    setErroAcao('');
    try {
      await api.put(`/iot/dispositivos/${id}/atuador`, corpo);
      painel.recarregar();
      eventos.recarregar();
    } catch (e) {
      setErroAcao(e.message);
    }
  };

  const linhas = [];
  if (atual.limite_max !== null) linhas.push({ y: atual.limite_max, rotulo: `máx ${atual.limite_max}`, cor: '#dc2626' });
  if (atual.limite_min !== null && atual.tipo !== 'PRESENCA') linhas.push({ y: atual.limite_min, rotulo: `mín ${numero(atual.limite_min, 0)}`, cor: '#d97706' });
  const grupos = [
    ['Sensores analógicos', dispositivos.filter((d) => d.papel === 'SENSOR' && d.natureza === 'ANALOGICO')],
    ['Sensores digitais', dispositivos.filter((d) => d.papel === 'SENSOR' && d.natureza === 'DIGITAL')],
    ['Atuadores (acionamento remoto)', dispositivos.filter((d) => d.papel === 'ATUADOR')],
  ];

  return (
    <>
      <div className="grade-kpi">
        <Cartao titulo="Sensores online" valor={`${resumo.sensores_online}/${resumo.sensores}`} tipo={resumo.sensores_online === resumo.sensores ? 'ok' : 'alerta'} />
        <Cartao titulo="Atuadores ligados" valor={`${resumo.atuadores_ligados}/${resumo.atuadores}`} />
        <Cartao titulo="Alertas abertos" valor={resumo.alertas_abertos} tipo={resumo.alertas_abertos ? 'erro' : 'ok'} />
        <Cartao titulo="Leituras armazenadas" valor={numero(resumo.leituras_total, 0)} detalhe="atualiza a cada 3 s" />
      </div>
      <MensagemErro erro={erroAcao} />

      {abertos.length > 0 && (
        <div className="aviso aviso-erro">
          <strong>⚠️ Alertas ativos</strong>
          <ul>{abertos.map((a) => <li key={a.id}>{a.mensagem} <small>({hora(a.criado_em)})</small></li>)}</ul>
        </div>
      )}

      <section className="secao">
        <h2>Gráfico ao vivo — {atual.nome}</h2>
        <GraficoLinha
          series={[{ nome: atual.nome, pontos: atual.serie.map((p) => ({ x: new Date(p.t).getTime(), y: p.v })) }]}
          linhas={linhas}
          formatoX={(x) => hora(new Date(x).toISOString())}
          formatoY={(y) => numero(y, atual.natureza === 'DIGITAL' ? 0 : 1)}
        />
      </section>

      {grupos.map(([titulo, lista]) => (
        <section className="secao" key={titulo}>
          <h2>{titulo}</h2>
          <div className="grade-dispositivos">
            {lista.map((d) => (
              <CartaoDispositivo key={d.id} d={d} selecionado={atual.id === d.id} aoSelecionar={setSelecionado} aoAcionar={acionar} />
            ))}
          </div>
        </section>
      ))}

      <section className="secao duas-colunas">
        <div>
          <h2>Histórico de alertas</h2>
          {alertas.length === 0 ? <div className="vazio">Nenhum alerta registrado.</div> : (
            <ul className="lista-simples">
              {alertas.slice(0, 8).map((a) => (
                <li key={a.id}>
                  <Selo tipo={a.resolvido_em ? 'ok' : 'erro'}>{a.resolvido_em ? 'Resolvido' : 'Aberto'}</Selo>
                  <span>{a.mensagem}</span>
                  <small>{dataHora(a.criado_em)}</small>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h2>Acionamentos de atuadores</h2>
          {!eventos.dados?.length ? <div className="vazio">Nenhum acionamento registrado.</div> : (
            <ul className="lista-simples">
              {eventos.dados.slice(0, 8).map((e) => (
                <li key={e.id}>
                  <Selo tipo={e.estado ? 'ok' : 'neutro'}>{e.estado ? 'Ligou' : 'Desligou'}</Selo>
                  <span>{e.dispositivo} · {e.modo === 'AUTO' ? 'automático' : 'manual'} <small>({e.origem === 'DISPOSITIVO' ? 'dispositivo' : e.origem.replace('USUARIO:', '')})</small></span>
                  <small>{dataHora(e.registrado_em)}</small>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </>
  );
}

function Estatisticas({ mercadoId }) {
  const lista = useCarregar(() => api.get(`/iot/mercados/${mercadoId}/painel?pontos=5`), [mercadoId]);
  const [id, setId] = useState('');
  const [minutos, setMinutos] = useState(120);
  const sensores = lista.dados?.dispositivos.filter((d) => d.papel === 'SENSOR') || [];
  const escolhido = id || sensores[0]?.id;
  const est = useCarregar(() => (escolhido ? api.get(`/estatisticas/dispositivos/${escolhido}?minutos=${minutos}`) : Promise.resolve(null)), [escolhido, minutos], 15000);

  if (!lista.dados) return <Carregando />;
  const e = est.dados;
  const d = e?.descritiva;
  const un = e?.dispositivo.unidade === '0/1' ? '' : ` ${e?.dispositivo.unidade || ''}`;
  const reg = e?.regressao;
  const linhaReg = reg ? [{ nome: 'Regressão linear', cor: '#dc2626', tracejado: true, pontos: reg.linha.map((p) => ({ x: p.x, y: p.y })) }] : [];
  const limites = [];
  if (e?.dispositivo.limite_max !== null && e) limites.push({ y: e.dispositivo.limite_max, rotulo: `máx ${e.dispositivo.limite_max}`, cor: '#dc2626' });
  if (e?.dispositivo.limite_min !== null && e && e.dispositivo.tipo !== 'PRESENCA') limites.push({ y: e.dispositivo.limite_min, rotulo: `mín ${numero(e.dispositivo.limite_min, 0)}`, cor: '#d97706' });
  const pa = e?.probabilidades.acima_do_limite_maximo;
  const pb = e?.probabilidades.abaixo_do_limite_minimo;

  return (
    <>
      <div className="filtros-linha">
        <label>
          Dispositivo
          <select value={escolhido || ''} onChange={(ev) => setId(ev.target.value)}>
            {sensores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nome}
              </option>
            ))}
          </select>
        </label>
        <label>
          Janela de análise
          <select value={minutos} onChange={(ev) => setMinutos(Number(ev.target.value))}>
            {[30, 60, 120, 240, 360].map((m) => (
              <option key={m} value={m}>
                últimos {m} min
              </option>
            ))}
          </select>
        </label>
      </div>
      {!e || !d || d.n < 3 ? <Carregando texto="Dados insuficientes na janela escolhida." /> : (
        <>
          <p className="subtitulo">{d.n} leituras analisadas.</p>
          <div className="grade-kpi">
            <Cartao titulo="Média" valor={`${numero(d.media)}${un}`} />
            <Cartao titulo="Mediana" valor={`${numero(d.mediana)}${un}`} />
            <Cartao titulo="Moda" valor={d.moda === null ? 'não há' : `${numero(d.moda)}${un}`} detalhe={d.frequencia_moda ? `${d.frequencia_moda} ocorrências` : undefined} />
            <Cartao titulo="Desvio padrão" valor={`${numero(d.desvio_padrao)}${un}`} detalhe={`variância ${numero(d.variancia)}`} />
            <Cartao titulo="Assimetria" valor={numero(d.assimetria)} detalhe={d.assimetria > 0.5 ? 'cauda à direita' : d.assimetria < -0.5 ? 'cauda à esquerda' : 'aprox. simétrica'} />
            <Cartao titulo="Curtose (excesso)" valor={numero(d.curtose)} detalhe={d.curtose > 0.5 ? 'caudas pesadas' : d.curtose < -0.5 ? 'achatada' : 'próxima da normal'} />
            <Cartao titulo="Mínimo / Máximo" valor={`${numero(d.minimo, 1)} / ${numero(d.maximo, 1)}`} detalhe={`amplitude ${numero(d.amplitude, 1)}`} />
            <Cartao titulo="Quartis (Q1 – Q3)" valor={`${numero(d.q1, 1)} – ${numero(d.q3, 1)}`} />
          </div>

          <section className="secao duas-colunas">
            <div>
              <h2>Série temporal e regressão linear</h2>
              <GraficoLinha
                series={[{ nome: 'Leituras', pontos: e.serie.map((p) => ({ x: p.horas, y: p.v })) }, ...linhaReg]}
                linhas={limites}
                formatoX={(x) => `${numero(x * 60, 0)} min`}
                formatoY={(y) => numero(y, e.dispositivo.natureza === 'DIGITAL' ? 1 : 1)}
              />
            </div>
            <div>
              <h2>Distribuição das leituras</h2>
              <Histograma
                bins={e.histograma.map((b) => ({ de: b.de, ate: b.ate, frequencia: b.frequencia }))}
                marcadores={[{ x: d.media, rotulo: 'média', cor: '#2563eb' }, { x: d.mediana, rotulo: 'mediana', cor: '#9333ea' }]}
              />
            </div>
          </section>

          <section className="secao duas-colunas">
            <div className="caixa">
              <h3>Regressão linear (leitura × tempo)</h3>
              {reg ? (
                <ul className="lista-simples compacta">
                  <li>Inclinação: <b>{numero(reg.inclinacao_por_unidade, 3)}{un} por hora</b></li>
                  <li>Intercepto: {numero(reg.intercepto, 3)}</li>
                  <li>Coeficiente de correlação r: {numero(reg.r, 3)} · R²: {numero(reg.r2, 3)}</li>
                  <li>Estatística t: {numero(reg.estatistica_t, 2)} →{' '}
                    <Selo tipo={reg.significativa ? 'alerta' : 'ok'}>{reg.significativa ? 'tendência significativa (α=5%)' : 'sem tendência significativa'}</Selo>
                  </li>
                  <li>Previsão em +1 h: <b>{numero(reg.previsoes[2]?.y, 2)}{un}</b></li>
                </ul>
              ) : <p>Sem dados suficientes.</p>}
            </div>
            <div className="caixa">
              <h3>Probabilidades e inferência</h3>
              <ul className="lista-simples compacta">
                {e.intervalo_confianca_95 && <li>IC 95% da média: <b>{numero(e.intervalo_confianca_95.inferior, 2)} a {numero(e.intervalo_confianca_95.superior, 2)}{un}</b></li>}
                {pa && <li>P(leitura &gt; {pa.limite}) — modelo normal: <b>{pct(pa.normal, 2)}</b> · observada: {pct(pa.empirica, 2)}</li>}
                {pb && <li>P(leitura &lt; {numero(pb.limite, 1)}) — modelo normal: <b>{pct(pb.normal, 2)}</b> · observada: {pct(pb.empirica, 2)}</li>}
                {e.probabilidades.proporcao_ligado !== undefined && <li>Proporção do tempo em nível alto (1): <b>{pct(e.probabilidades.proporcao_ligado, 1)}</b></li>}
                <li>Coef. de variação: {numero((d.coeficiente_variacao || 0) * 100, 1)}%</li>
              </ul>
            </div>
          </section>
        </>
      )}
    </>
  );
}

function Precos({ mercadoId }) {
  const tabela = useCarregar(() => api.get(`/mercados/${mercadoId}/precos`), [mercadoId]);
  const [filtro, setFiltro] = useState('');
  const [edicao, setEdicao] = useState({});
  const [msg, setMsg] = useState('');
  const [erro, setErro] = useState('');
  if (!tabela.dados) return <Carregando />;
  const linhas = tabela.dados.filter((l) => l.nome.toLowerCase().includes(filtro.toLowerCase()));

  const salvar = async (l) => {
    const e = edicao[l.produto_id] || {};
    try {
      await api.put(`/mercados/${mercadoId}/precos/${l.produto_id}`, {
        preco: e.preco === undefined ? undefined : Number(String(e.preco).replace(',', '.')),
        estoque: e.estoque === undefined ? undefined : Number(e.estoque),
      });
      setEdicao((s) => ({ ...s, [l.produto_id]: undefined }));
      setMsg(`${l.nome}: atualizado.`);
      setErro('');
      tabela.recarregar();
    } catch (err) {
      setErro(err.message);
    }
  };

  return (
    <>
      <p className="subtitulo">Ao baixar um preço, consumidores que favoritaram o produto recebem uma notificação. Itens monitorados por balança IoT têm o estoque atualizado automaticamente.</p>
      <input className="campo-busca" placeholder="Filtrar produtos..." value={filtro} onChange={(e) => setFiltro(e.target.value)} />
      {msg && <div className="aviso aviso-ok">{msg}</div>}
      <MensagemErro erro={erro} />
      <div className="tabela-rolagem">
        <table className="tabela">
          <thead>
            <tr><th>Produto</th><th>Categoria</th><th>Preço (R$)</th><th>Estoque</th><th /></tr>
          </thead>
          <tbody>
            {linhas.slice(0, 80).map((l) => {
              const e = edicao[l.produto_id] || {};
              return (
                <tr key={l.produto_id}>
                  <td>{l.nome} {l.monitorado_por_iot > 0 && <Selo tipo="ok">balança IoT</Selo>}</td>
                  <td>{l.categoria}</td>
                  <td><input className="campo-tabela" value={e.preco ?? l.preco.toFixed(2)} onChange={(ev) => setEdicao((s) => ({ ...s, [l.produto_id]: { ...e, preco: ev.target.value } }))} inputMode="decimal" aria-label={`Preço de ${l.nome}`} /></td>
                  <td><input className="campo-tabela" type="number" value={e.estoque ?? l.estoque} disabled={l.monitorado_por_iot > 0} onChange={(ev) => setEdicao((s) => ({ ...s, [l.produto_id]: { ...e, estoque: ev.target.value } }))} aria-label={`Estoque de ${l.nome}`} /></td>
                  <td><button className="botao pequeno" disabled={!edicao[l.produto_id]} onClick={() => salvar(l)}>Salvar</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Conectar({ mercadoId }) {
  const chave = useCarregar(() => api.get(`/iot/mercados/${mercadoId}/chave`), [mercadoId]);
  const dispositivos = useCarregar(() => api.get(`/iot/mercados/${mercadoId}/painel?pontos=5`), [mercadoId]);
  const origem = window.location.origin;
  return (
    <div className="caixa">
      <h3>Conectar dispositivos reais (ESP32, Arduino, gateway)</h3>
      <p>Qualquer dispositivo com HTTP pode enviar leituras. A chave identifica o supermercado:</p>
      <pre className="codigo">{chave.dados?.chave || '...'}</pre>
      <p>Exemplo de envio (JSON via HTTP POST) — o retorno traz os comandos dos atuadores:</p>
      <pre className="codigo">{`POST ${origem}/api/iot/leituras
X-Chave-Iot: ${chave.dados?.chave || '<chave>'}
Content-Type: application/json

{ "leituras": [ { "dispositivo_id": ${dispositivos.dados?.dispositivos[0]?.id ?? 1}, "valor": 4.3 } ] }`}</pre>
      <p>
        Documentação completa (OpenAPI/Swagger): <a href="/api/docs" target="_blank" rel="noreferrer">/api/docs</a>
      </p>
      <h3>Dispositivos cadastrados</h3>
      <table className="tabela">
        <thead><tr><th>ID</th><th>Nome</th><th>Tipo</th><th>Natureza</th><th>Papel</th></tr></thead>
        <tbody>
          {dispositivos.dados?.dispositivos.map((d) => (
            <tr key={d.id}><td>{d.id}</td><td>{d.nome}</td><td>{d.tipo}</td><td>{d.natureza === 'ANALOGICO' ? 'Analógico' : 'Digital'}</td><td>{d.papel === 'SENSOR' ? 'Sensor' : 'Atuador'}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PainelConteudo() {
  const { usuario } = useAuth();
  const mercados = useCarregar(() => api.get('/mercados'), []);
  const [escolhido, setEscolhido] = useState(null);
  const [aba, setAba] = useState('tempo');
  const mercadoId = usuario.papel === 'MERCADO' ? usuario.mercado_id : escolhido || mercados.dados?.[0]?.id;
  const nome = mercados.dados?.find((m) => m.id === mercadoId)?.nome;

  useEffect(() => {
    if (usuario.papel === 'ADMIN' && mercados.dados && !escolhido) setEscolhido(mercados.dados[0].id);
  }, [mercados.dados, usuario, escolhido]);

  if (!mercadoId) return <Carregando />;
  return (
    <div>
      <div className="linha-titulo">
        <div>
          <span className="categoria-nome">Portal do supermercado · IoT</span>
          <h1>Painel — {nome}</h1>
        </div>
        {usuario.papel === 'ADMIN' && (
          <select value={mercadoId} onChange={(e) => setEscolhido(Number(e.target.value))} aria-label="Supermercado">
            {mercados.dados?.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
          </select>
        )}
      </div>
      <Abas abas={[['tempo', 'Tempo real'], ['estatisticas', 'Estatísticas'], ['precos', 'Preços e estoque'], ['conectar', 'Conectar dispositivos']]} ativa={aba} aoMudar={setAba} />
      {aba === 'tempo' && <TempoReal mercadoId={mercadoId} />}
      {aba === 'estatisticas' && <Estatisticas mercadoId={mercadoId} />}
      {aba === 'precos' && <Precos mercadoId={mercadoId} />}
      {aba === 'conectar' && <Conectar mercadoId={mercadoId} />}
    </div>
  );
}

export default function PainelMercado() {
  return (
    <Protegido papeis={['MERCADO', 'ADMIN']}>
      <PainelConteudo />
    </Protegido>
  );
}
