import React, { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { api, montarQuery } from '../api';
import { useAuth, useCarregar, useCarrinho } from '../estado';
import { Aviso, Barras, Botao, estilos, GraficoLinha, Imagem, KPI, Selo, cores, CORES_SERIES } from '../ui';
import { dataCurta, moeda, numero } from '../formatos';

const CADEIA = { OK: ['ok', 'Cadeia fria OK'], ALERTA: ['erro', 'Alerta de temperatura'], SEM_DADOS: ['neutro', 'Sem dados'] };
const DIRECAO = { ALTA: ['erro', '↑ em alta'], QUEDA: ['ok', '↓ em queda'], ESTAVEL: ['neutro', '→ estável'] };

function CartaoProduto({ produto, aoAbrir }) {
  const { adicionar } = useCarrinho();
  const [ok, setOk] = useState(false);
  const melhor = produto.ofertas.find((o) => o.melhor);
  return (
    <Pressable style={estilos.card} onPress={() => aoAbrir(produto)}>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Imagem uri={produto.imagem_url} icone={produto.icone} tamanho={64} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 11, fontWeight: '700', color: cores.suave, textTransform: 'uppercase' }}>{produto.categoria}</Text>
          <Text style={{ fontWeight: '700', color: cores.texto }}>{produto.nome}</Text>
          {produto.economia > 0 && produto.ofertas.length > 1 && <Text style={{ color: cores.alerta, fontSize: 12, fontWeight: '700' }}>Economize até {moeda(produto.economia)}</Text>}
        </View>
      </View>
      <View style={{ marginTop: 8 }}>
        {produto.ofertas.slice(0, 5).map((o) => (
          <View key={o.mercado_id} style={[estilos.linha, { paddingVertical: 2, paddingHorizontal: 6, borderRadius: 6, backgroundColor: o.melhor ? cores.verdeClaro : 'transparent' }]}>
            <Text style={{ fontWeight: o.melhor ? '800' : '400', color: o.disponivel ? cores.texto : '#94a3b8' }}>{o.mercado}</Text>
            <Text style={{ fontWeight: o.melhor ? '800' : '400', color: o.disponivel ? cores.texto : '#94a3b8' }}>{o.disponivel ? `${moeda(o.preco)}${o.melhor ? ' 🏆' : ''}` : 'sem estoque'}</Text>
          </View>
        ))}
      </View>
      <View style={[estilos.linha, { marginTop: 8 }]}>
        <View>
          <Text style={estilos.suave}>{melhor ? `Melhor preço: ${melhor.mercado}` : 'Sem estoque'}</Text>
          <Text style={{ fontSize: 20, fontWeight: '900', color: cores.verdeEscuro }}>{melhor ? moeda(melhor.preco) : '—'}</Text>
        </View>
        <Botao
          pequeno
          titulo={ok ? '✓ Adicionado' : '🛒 Adicionar'}
          desabilitado={!melhor}
          aoPressionar={() => {
            adicionar(produto);
            setOk(true);
            setTimeout(() => setOk(false), 1200);
          }}
        />
      </View>
    </Pressable>
  );
}

function Detalhe({ produto, aoVoltar }) {
  const { usuario } = useAuth();
  const { adicionar } = useCarrinho();
  const dados = useCarregar(() => api.get(`/produtos/${produto.id}`), [produto.id], 20000);
  const stats = useCarregar(() => api.get(`/estatisticas/produtos/${produto.id}`), [produto.id]);
  const [favorito, setFavorito] = useState(null);
  const p = dados.dados;
  const fav = favorito ?? p?.favorito ?? false;

  const alternarFavorito = async () => {
    const novo = !fav;
    setFavorito(novo);
    try {
      if (novo) await api.put(`/favoritos/${produto.id}`);
      else await api.del(`/favoritos/${produto.id}`);
    } catch {
      setFavorito(!novo);
    }
  };

  const series = p
    ? [...new Set(p.historico.map((h) => h.mercado))].map((nome, i) => ({
        nome,
        cor: CORES_SERIES[i % CORES_SERIES.length],
        pontos: p.historico.filter((h) => h.mercado === nome).map((h) => ({ x: new Date(h.registrado_em).getTime(), y: h.preco })),
      }))
    : [];
  const d = stats.dados?.comparacao_atual.descritiva;

  return (
    <ScrollView style={estilos.tela} contentContainerStyle={estilos.conteudo}>
      <Botao tipo="claro" pequeno titulo="← Voltar" aoPressionar={aoVoltar} />
      <Aviso texto={dados.erro} />
      {!p ? <ActivityIndicator color={cores.verde} style={{ marginTop: 30 }} /> : (
        <>
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 12, alignItems: 'center' }}>
            <Imagem uri={p.imagem_url} icone={p.icone} tamanho={80} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: cores.suave }}>{p.categoria.toUpperCase()}</Text>
              <Text style={{ fontSize: 18, fontWeight: '800' }}>{p.nome}</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
            <View style={{ flex: 1 }}>
              <Botao titulo="🛒 Adicionar ao carrinho" desabilitado={!p.ofertas.some((o) => o.melhor)} aoPressionar={() => adicionar(p)} />
            </View>
            {usuario && <Botao tipo="claro" titulo={fav ? '♥' : '♡'} aoPressionar={alternarFavorito} />}
          </View>

          <Text style={estilos.subtitulo}>Preço em cada supermercado</Text>
          <Barras itens={p.ofertas.filter((o) => o.disponivel).map((o) => ({ rotulo: o.mercado, valor: o.preco }))} formato={moeda} />
          {p.ofertas.map((o) => (
            <View key={o.mercado_id} style={[estilos.linha, { paddingVertical: 3 }]}>
              <Text>{o.mercado}</Text>
              <Selo tipo={o.estoque <= 0 ? 'erro' : o.estoque <= 5 ? 'alerta' : 'ok'}>{o.estoque <= 0 ? 'Indisponível' : o.estoque <= 5 ? `Últimas ${o.estoque} un.` : 'Em estoque'}</Selo>
            </View>
          ))}

          <Text style={estilos.subtitulo}>Histórico de preços (30 dias)</Text>
          <GraficoLinha series={series} formatoX={dataCurta} formatoY={(y) => moeda(y)} />

          <Text style={estilos.subtitulo}>Análise estatística</Text>
          {d ? (
            <>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                <KPI titulo="Média" valor={moeda(d.media)} />
                <KPI titulo="Mediana" valor={moeda(d.mediana)} />
                <KPI titulo="Desvio padrão" valor={moeda(d.desvio_padrao)} />
                <KPI titulo="Assimetria" valor={numero(d.assimetria)} />
              </View>
              {stats.dados.por_mercado.map((m) => (
                <View key={m.mercado_id} style={[estilos.card, estilos.linha]}>
                  <View>
                    <Text style={{ fontWeight: '700' }}>{m.mercado}</Text>
                    <Text style={estilos.suave}>{m.tendencia ? `${numero(m.tendencia.reais_por_dia, 4)} R$/dia · R² ${numero(m.tendencia.r2, 2)} · 7d: ${moeda(m.tendencia.previsao_7_dias)}` : ''}</Text>
                  </View>
                  {m.tendencia && <Selo tipo={DIRECAO[m.tendencia.direcao][0]}>{DIRECAO[m.tendencia.direcao][1]}</Selo>}
                </View>
              ))}
            </>
          ) : <ActivityIndicator color={cores.verde} />}
        </>
      )}
    </ScrollView>
  );
}

export default function Buscar() {
  const [texto, setTexto] = useState('');
  const [termo, setTermo] = useState('');
  const [categoria, setCategoria] = useState('');
  const [mercado, setMercado] = useState('');
  const [aberto, setAberto] = useState(null);
  const categorias = useCarregar(() => api.get('/categorias'), []);
  const mercados = useCarregar(() => api.get('/mercados'), [], 20000);
  const resultado = useCarregar(() => api.get(`/produtos${montarQuery({ q: termo, categoria, mercado, ordem: termo || categoria || mercado ? 'preco' : 'economia', limite: 40 })}`), [termo, categoria, mercado]);

  if (aberto) return <Detalhe produto={aberto} aoVoltar={() => setAberto(null)} />;

  return (
    <FlatList
      style={estilos.tela}
      contentContainerStyle={estilos.conteudo}
      data={resultado.dados?.produtos || []}
      keyExtractor={(p) => String(p.id)}
      renderItem={({ item }) => <CartaoProduto produto={item} aoAbrir={setAberto} />}
      ListHeaderComponent={
        <View>
          <Text style={estilos.titulo}>Compare preços</Text>
          <Text style={[estilos.suave, { marginBottom: 10 }]}>Encontre o supermercado mais barato e veja o que está em estoque agora.</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput style={[estilos.input, { flex: 1 }]} placeholder="Arroz, leite, café..." value={texto} onChangeText={setTexto} onSubmitEditing={() => setTermo(texto.trim())} returnKeyType="search" />
            <Botao titulo="Buscar" aoPressionar={() => setTermo(texto.trim())} />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
            {[{ id: '', nome: 'Todas', icone: '🏷️' }, ...(categorias.dados || [])].map((c) => (
              <Pressable key={c.id} onPress={() => setCategoria(String(c.id))} style={{ marginRight: 8, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, backgroundColor: categoria === String(c.id) ? cores.verde : '#fff', borderWidth: 1, borderColor: cores.borda }}>
                <Text style={{ color: categoria === String(c.id) ? '#fff' : cores.texto, fontWeight: '600' }}>{c.icone} {c.nome}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <Text style={estilos.subtitulo}>Supermercados</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {[{ id: '', nome: 'Todos' }, ...(mercados.dados || [])].map((m) => (
              <Pressable key={m.id} onPress={() => setMercado(String(m.id))} style={[estilos.card, { marginRight: 8, minWidth: 130, borderColor: mercado === String(m.id) ? cores.verde : cores.borda, borderWidth: mercado === String(m.id) ? 2 : 1 }]}>
                <Text style={{ fontWeight: '800' }}>{m.nome}</Text>
                {m.cadeia_fria && <Selo tipo={CADEIA[m.cadeia_fria][0]}>❄️ {CADEIA[m.cadeia_fria][1]}</Selo>}
              </Pressable>
            ))}
          </ScrollView>
          <Aviso texto={resultado.erro} />
          <Text style={estilos.subtitulo}>{termo ? `Resultados para "${termo}"` : categoria || mercado ? 'Produtos' : 'Maiores diferenças de preço'}</Text>
          {resultado.carregando && !resultado.dados && <ActivityIndicator color={cores.verde} />}
        </View>
      }
      ListEmptyComponent={!resultado.carregando ? <Text style={[estilos.suave, { textAlign: 'center', marginTop: 20 }]}>Nenhum produto encontrado.</Text> : null}
    />
  );
}
