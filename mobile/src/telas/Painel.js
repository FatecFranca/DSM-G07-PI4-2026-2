import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { api } from '../api';
import { useAuth, useCarregar } from '../estado';
import { Aviso, Botao, estilos, GraficoLinha, Histograma, KPI, Selo, Spark, cores } from '../ui';
import { hora, numero, pct } from '../formatos';

const fora = (d) => d.ultimo_valor !== null && ((d.limite_max !== null && d.ultimo_valor > d.limite_max) || (d.limite_min !== null && d.ultimo_valor < d.limite_min));

function textoValor(d) {
  if (d.ultimo_valor === null) return '—';
  if (d.tipo === 'PORTA') return d.ultimo_valor >= 0.5 ? 'Aberta' : 'Fechada';
  if (d.tipo === 'PRESENCA') return d.ultimo_valor >= 0.5 ? 'Detectada' : 'Livre';
  if (d.papel === 'ATUADOR') return d.estado ? 'Ligado' : 'Desligado';
  return `${numero(d.ultimo_valor, 1)} ${d.unidade}`;
}

function Dispositivo({ d, aoSelecionar, selecionado, aoAcionar }) {
  const alerta = fora(d);
  const atuador = d.papel === 'ATUADOR';
  return (
    <Pressable onPress={() => !atuador && aoSelecionar(d.id)} style={[estilos.card, alerta && { borderColor: '#fca5a5', backgroundColor: '#fff7f7' }, selecionado && { borderColor: cores.verde, borderWidth: 2 }, !d.online && { opacity: 0.6 }]}>
      <View style={estilos.linha}>
        <View style={{ flex: 1, paddingRight: 8 }}>
          <Text style={{ fontWeight: '800' }}>{d.nome}</Text>
          <Text style={estilos.suave}>{d.local}</Text>
        </View>
        <Selo tipo={!d.online ? 'neutro' : alerta ? 'erro' : 'ok'}>{!d.online ? 'Offline' : alerta ? 'Alerta' : atuador ? 'Online' : 'Normal'}</Selo>
      </View>
      <View style={[estilos.linha, { marginTop: 6 }]}>
        <View>
          <Text style={{ fontSize: 22, fontWeight: '900', color: atuador ? (d.estado ? cores.verdeEscuro : cores.suave) : cores.texto }}>{textoValor(d)}</Text>
          {d.estoque_estimado !== null && <Text style={estilos.suave}>≈ {d.estoque_estimado} un. de {d.produto_nome}</Text>}
        </View>
        {atuador ? (
          <View style={{ alignItems: 'flex-end', gap: 4 }}>
            <Switch value={!!d.estado} onValueChange={(v) => aoAcionar(d.id, { estado: v })} trackColor={{ true: cores.verde, false: '#cbd5e1' }} />
            <Selo tipo={d.modo === 'AUTO' ? 'ok' : 'alerta'}>{d.modo === 'AUTO' ? 'Automático' : 'Manual'}</Selo>
          </View>
        ) : (
          <Spark valores={d.serie.map((p) => p.v)} cor={alerta ? cores.erro : cores.verde} />
        )}
      </View>
      {atuador && d.modo === 'MANUAL' && (
        <View style={{ marginTop: 8 }}>
          <Botao pequeno tipo="claro" titulo="Voltar ao automático" aoPressionar={() => aoAcionar(d.id, { modo: 'AUTO' })} />
        </View>
      )}
      <Text style={[estilos.suave, { fontSize: 11, marginTop: 4 }]}>Última leitura: {hora(d.ultima_leitura_em)}</Text>
    </Pressable>
  );
}

function TempoReal({ mercadoId }) {
  const painel = useCarregar(() => api.get(`/iot/mercados/${mercadoId}/painel?pontos=60`), [mercadoId], 3000);
  const [selecionado, setSelecionado] = useState(null);
  const [erro, setErro] = useState('');
  if (!painel.dados) return painel.erro ? <Aviso texto={painel.erro} /> : <ActivityIndicator color={cores.verde} />;
  const { dispositivos, alertas, resumo } = painel.dados;
  const sensores = dispositivos.filter((d) => d.papel === 'SENSOR');
  const atual = sensores.find((d) => d.id === selecionado) || sensores[0];
  const abertos = alertas.filter((a) => !a.resolvido_em);
  const linhas = [];
  if (atual.limite_max !== null) linhas.push({ y: atual.limite_max, rotulo: `máx ${atual.limite_max}`, cor: cores.erro });
  if (atual.limite_min !== null && atual.tipo !== 'PRESENCA') linhas.push({ y: atual.limite_min, rotulo: `mín ${numero(atual.limite_min, 0)}`, cor: cores.alerta });

  const acionar = async (id, corpo) => {
    setErro('');
    try {
      await api.put(`/iot/dispositivos/${id}/atuador`, corpo);
      painel.recarregar();
    } catch (e) {
      setErro(e.message);
    }
  };

  return (
    <View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 8 }}>
        <KPI titulo="Sensores online" valor={`${resumo.sensores_online}/${resumo.sensores}`} cor={resumo.sensores_online === resumo.sensores ? cores.verdeEscuro : cores.alerta} />
        <KPI titulo="Atuadores ligados" valor={`${resumo.atuadores_ligados}/${resumo.atuadores}`} />
        <KPI titulo="Alertas abertos" valor={resumo.alertas_abertos} cor={resumo.alertas_abertos ? cores.erro : cores.verdeEscuro} />
        <KPI titulo="Leituras" valor={resumo.leituras_total} detalhe="atualiza a cada 3 s" />
      </View>
      <Aviso texto={erro} />
      {abertos.length > 0 && (
        <View style={{ backgroundColor: '#fee2e2', borderRadius: 10, padding: 10, marginBottom: 10 }}>
          <Text style={{ color: '#991b1b', fontWeight: '800' }}>⚠️ Alertas ativos</Text>
          {abertos.map((a) => <Text key={a.id} style={{ color: '#991b1b' }}>• {a.mensagem}</Text>)}
        </View>
      )}
      <Text style={estilos.subtitulo}>Gráfico ao vivo — {atual.nome}</Text>
      <GraficoLinha series={[{ nome: atual.nome, pontos: atual.serie.map((p) => ({ x: new Date(p.t).getTime(), y: p.v })) }]} linhas={linhas} formatoX={(x) => hora(new Date(x).toISOString())} />
      {[['Sensores', sensores], ['Atuadores (toque para acionar)', dispositivos.filter((d) => d.papel === 'ATUADOR')]].map(([titulo, lista]) => (
        <View key={titulo}>
          <Text style={estilos.subtitulo}>{titulo}</Text>
          {lista.map((d) => <Dispositivo key={d.id} d={d} selecionado={atual.id === d.id} aoSelecionar={setSelecionado} aoAcionar={acionar} />)}
        </View>
      ))}
    </View>
  );
}

function Estatisticas({ mercadoId }) {
  const lista = useCarregar(() => api.get(`/iot/mercados/${mercadoId}/painel?pontos=5`), [mercadoId]);
  const [id, setId] = useState(null);
  const [minutos, setMinutos] = useState(120);
  const sensores = lista.dados?.dispositivos.filter((d) => d.papel === 'SENSOR') || [];
  const escolhido = id || sensores[0]?.id;
  const est = useCarregar(() => (escolhido ? api.get(`/estatisticas/dispositivos/${escolhido}?minutos=${minutos}`) : Promise.resolve(null)), [escolhido, minutos], 15000);
  const e = est.dados;
  const d = e?.descritiva;
  const un = e && e.dispositivo.unidade !== '0/1' ? ` ${e.dispositivo.unidade || ''}` : '';
  const reg = e?.regressao;
  const limites = [];
  if (e?.dispositivo.limite_max != null) limites.push({ y: e.dispositivo.limite_max, rotulo: `máx ${e.dispositivo.limite_max}`, cor: cores.erro });
  if (e?.dispositivo.limite_min != null && e.dispositivo.tipo !== 'PRESENCA') limites.push({ y: e.dispositivo.limite_min, rotulo: `mín ${numero(e.dispositivo.limite_min, 0)}`, cor: cores.alerta });
  const pa = e?.probabilidades.acima_do_limite_maximo;
  const pb = e?.probabilidades.abaixo_do_limite_minimo;

  return (
    <View>
      <Text style={estilos.rotulo}>Dispositivo</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {sensores.map((s) => (
          <Pressable key={s.id} onPress={() => setId(s.id)} style={{ marginRight: 8, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, backgroundColor: escolhido === s.id ? cores.verde : '#fff', borderWidth: 1, borderColor: cores.borda }}>
            <Text style={{ color: escolhido === s.id ? '#fff' : cores.texto, fontWeight: '600' }}>{s.nome}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <Text style={estilos.rotulo}>Janela de análise</Text>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {[30, 60, 120, 240].map((m) => (
          <Pressable key={m} onPress={() => setMinutos(m)} style={{ paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, backgroundColor: minutos === m ? cores.verde : '#fff', borderWidth: 1, borderColor: cores.borda }}>
            <Text style={{ color: minutos === m ? '#fff' : cores.texto, fontWeight: '600' }}>{m} min</Text>
          </Pressable>
        ))}
      </View>
      <Aviso texto={est.erro} />
      {!d || d.n < 3 ? <ActivityIndicator color={cores.verde} style={{ marginTop: 20 }} /> : (
        <>
          <Text style={[estilos.suave, { marginTop: 8 }]}>{d.n} leituras analisadas</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 8 }}>
            <KPI titulo="Média" valor={`${numero(d.media)}${un}`} />
            <KPI titulo="Mediana" valor={`${numero(d.mediana)}${un}`} />
            <KPI titulo="Moda" valor={d.moda === null ? 'não há' : `${numero(d.moda)}${un}`} />
            <KPI titulo="Desvio padrão" valor={`${numero(d.desvio_padrao)}${un}`} />
            <KPI titulo="Assimetria" valor={numero(d.assimetria)} />
            <KPI titulo="Curtose" valor={numero(d.curtose)} />
          </View>
          <Text style={estilos.subtitulo}>Série e regressão linear</Text>
          <GraficoLinha
            series={[{ nome: 'Leituras', pontos: e.serie.map((p) => ({ x: p.horas, y: p.v })) }, ...(reg ? [{ nome: 'Regressão', cor: cores.erro, tracejado: true, pontos: reg.linha }] : [])]}
            linhas={limites}
            formatoX={(x) => `${numero(x * 60, 0)} min`}
          />
          <Text style={estilos.subtitulo}>Distribuição</Text>
          <Histograma bins={e.histograma} />
          <View style={estilos.card}>
            <Text style={{ fontWeight: '800', marginBottom: 4 }}>Regressão e inferência</Text>
            {reg && <Text>Inclinação: <Text style={{ fontWeight: '800' }}>{numero(reg.inclinacao_por_unidade, 3)}{un}/h</Text> · R² {numero(reg.r2, 3)}</Text>}
            {reg && <Text>{reg.significativa ? '⚠️ tendência significativa (α=5%)' : '✓ sem tendência significativa'}</Text>}
            {e.intervalo_confianca_95 && <Text>IC 95% da média: {numero(e.intervalo_confianca_95.inferior)} a {numero(e.intervalo_confianca_95.superior)}{un}</Text>}
            {pa && <Text>P(&gt; {pa.limite}) normal: {pct(pa.normal, 2)} · observada {pct(pa.empirica, 2)}</Text>}
            {pb && <Text>P(&lt; {numero(pb.limite, 1)}) normal: {pct(pb.normal, 2)} · observada {pct(pb.empirica, 2)}</Text>}
          </View>
        </>
      )}
    </View>
  );
}

export default function Painel({ irParaConta }) {
  const { usuario } = useAuth();
  const mercados = useCarregar(() => api.get('/mercados'), []);
  const [escolhido, setEscolhido] = useState(null);
  const [aba, setAba] = useState('tempo');

  if (!usuario || !['MERCADO', 'ADMIN'].includes(usuario.papel)) {
    return (
      <ScrollView style={estilos.tela} contentContainerStyle={estilos.conteudo}>
        <Text style={estilos.titulo}>Painel IoT</Text>
        <Text style={[estilos.suave, { marginBottom: 12 }]}>Dashboard dos sensores e atuadores do supermercado. Entre com uma conta de supermercado ou administrador.</Text>
        <Botao titulo="Ir para Conta" aoPressionar={irParaConta} />
        <Text style={estilos.subtitulo}>Cadeia fria dos mercados</Text>
        <Aviso texto={mercados.erro} />
        {mercados.dados?.map((m) => (
          <View key={m.id} style={[estilos.card, estilos.linha]}>
            <Text style={{ fontWeight: '800' }}>{m.nome}</Text>
            <Selo tipo={m.cadeia_fria === 'OK' ? 'ok' : m.cadeia_fria === 'ALERTA' ? 'erro' : 'neutro'}>❄️ {m.cadeia_fria === 'OK' ? 'OK' : m.cadeia_fria === 'ALERTA' ? 'Alerta' : 'Sem dados'}</Selo>
          </View>
        ))}
      </ScrollView>
    );
  }

  const mercadoId = usuario.papel === 'MERCADO' ? usuario.mercado_id : escolhido || mercados.dados?.[0]?.id;
  const nome = mercados.dados?.find((m) => m.id === mercadoId)?.nome;

  return (
    <ScrollView style={estilos.tela} contentContainerStyle={estilos.conteudo}>
      <Text style={{ fontSize: 11, fontWeight: '700', color: cores.suave }}>PORTAL DO SUPERMERCADO · IOT</Text>
      <Text style={estilos.titulo}>Painel — {nome || '...'}</Text>
      {usuario.papel === 'ADMIN' && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 6 }}>
          {mercados.dados?.map((m) => (
            <Pressable key={m.id} onPress={() => setEscolhido(m.id)} style={{ marginRight: 8, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, backgroundColor: mercadoId === m.id ? cores.verde : '#fff', borderWidth: 1, borderColor: cores.borda }}>
              <Text style={{ color: mercadoId === m.id ? '#fff' : cores.texto, fontWeight: '600' }}>{m.nome}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
        {[['tempo', 'Tempo real'], ['estatisticas', 'Estatísticas']].map(([k, r]) => (
          <View key={k} style={{ flex: 1 }}>
            <Botao titulo={r} tipo={aba === k ? 'primario' : 'claro'} aoPressionar={() => setAba(k)} />
          </View>
        ))}
      </View>
      {mercadoId ? (aba === 'tempo' ? <TempoReal mercadoId={mercadoId} /> : <Estatisticas mercadoId={mercadoId} />) : <ActivityIndicator color={cores.verde} />}
    </ScrollView>
  );
}
