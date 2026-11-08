import React, { useEffect, useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { api } from '../api';
import { useAuth, useCarrinho } from '../estado';
import { Aviso, Botao, estilos, Imagem, Selo, cores } from '../ui';
import { moeda, pct } from '../formatos';

export function ResultadoComparacao({ r }) {
  if (!r.ranking.length) return <Text style={estilos.suave}>Nenhum mercado possui estes produtos em estoque.</Text>;
  const melhor = r.melhor_mercado;
  return (
    <View>
      <View style={{ backgroundColor: '#0f172a', borderRadius: 16, padding: 16, marginBottom: 10 }}>
        <Text style={{ color: '#4ade80', fontWeight: '800', fontSize: 11 }}>🏆 MELHOR MERCADO PARA ESTA LISTA</Text>
        <Text style={{ color: '#fff', fontSize: 20, fontWeight: '800' }}>{melhor.mercado}</Text>
        <Text style={{ color: '#fff', fontSize: 30, fontWeight: '900' }}>{moeda(melhor.total)}</Text>
        <Text style={{ color: '#cbd5e1' }}>{melhor.disponiveis} de {melhor.total_itens} itens ({pct(melhor.cobertura, 0)})</Text>
      </View>
      {r.economia_vs_mais_caro > 0 && (
        <View style={{ backgroundColor: cores.verdeClaro, borderRadius: 14, padding: 14, marginBottom: 10 }}>
          <Text style={{ color: '#166534' }}>Economia em relação ao mais caro</Text>
          <Text style={{ color: cores.verdeEscuro, fontSize: 24, fontWeight: '900' }}>{moeda(r.economia_vs_mais_caro)}</Text>
          {r.combinacao_otima.economia_vs_melhor_mercado > 0 && (
            <Text style={{ color: '#166534', marginTop: 4 }}>💡 Comprando cada item no mais barato, o total cai para {moeda(r.combinacao_otima.total)}.</Text>
          )}
        </View>
      )}
      {r.ranking.map((m, i) => (
        <View key={m.mercado_id} style={[estilos.card, i === 0 && { borderColor: cores.verde, borderWidth: 2 }]}>
          <View style={estilos.linha}>
            <Text style={{ fontWeight: '800' }}>{i + 1}º {m.mercado}</Text>
            <Text style={{ fontWeight: '900', fontSize: 16 }}>{moeda(m.total)}</Text>
          </View>
          <View style={{ marginTop: 4 }}>
            {m.completo ? <Selo tipo="ok">Lista completa</Selo> : <Selo tipo="alerta">Faltam: {m.faltantes.join(', ')}</Selo>}
          </View>
        </View>
      ))}
    </View>
  );
}

export default function Carrinho() {
  const { itens, alterar, remover, limpar } = useCarrinho();
  const { usuario } = useAuth();
  const [resultado, setResultado] = useState(null);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [nome, setNome] = useState('');

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
    try {
      const titulo = nome.trim() || `Lista de ${new Date().toLocaleDateString('pt-BR')}`;
      await api.post('/listas', { nome: titulo, itens: itens.map((i) => ({ produto_id: i.id, quantidade: i.quantidade })) });
      setAviso(`Lista "${titulo}" salva na aba Conta.`);
      setNome('');
    } catch (e) {
      setErro(e.message);
    }
  };

  if (!itens.length) {
    return (
      <View style={[estilos.tela, { alignItems: 'center', justifyContent: 'center', padding: 24 }]}>
        <Text style={{ fontSize: 56 }}>🛒</Text>
        <Text style={estilos.titulo}>Carrinho vazio</Text>
        <Text style={[estilos.suave, { textAlign: 'center' }]}>Adicione produtos na aba Buscar para descobrir onde a compra fica mais barata.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={estilos.tela} contentContainerStyle={estilos.conteudo}>
      <View style={estilos.linha}>
        <Text style={estilos.titulo}>Carrinho</Text>
        <Botao pequeno tipo="claro" titulo="Limpar" aoPressionar={limpar} />
      </View>
      <Aviso texto={erro} />
      <Aviso texto={aviso} tipo="ok" />
      {itens.map((i) => (
        <View key={i.id} style={[estilos.card, { flexDirection: 'row', alignItems: 'center', gap: 10 }]}>
          <Imagem icone={i.icone} tamanho={44} />
          <Text style={{ flex: 1, fontWeight: '700' }}>{i.nome}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Botao pequeno tipo="claro" titulo="−" aoPressionar={() => alterar(i.id, -1)} />
            <Text style={{ fontWeight: '800' }}>{i.quantidade}</Text>
            <Botao pequeno tipo="claro" titulo="+" aoPressionar={() => alterar(i.id, 1)} />
            <Text style={{ color: cores.suave, fontSize: 18 }} onPress={() => remover(i.id)}>✕</Text>
          </View>
        </View>
      ))}
      <Text style={estilos.subtitulo}>Comparação entre supermercados</Text>
      {resultado ? <ResultadoComparacao r={resultado} /> : <Text style={estilos.suave}>Calculando...</Text>}
      {usuario ? (
        <>
          <Text style={estilos.rotulo}>Salvar como lista</Text>
          <TextInput style={estilos.input} placeholder="Nome da lista (opcional)" value={nome} onChangeText={setNome} />
          <View style={{ marginTop: 8 }}>
            <Botao titulo="Salvar lista" aoPressionar={salvar} />
          </View>
        </>
      ) : (
        <Text style={[estilos.suave, { marginTop: 14 }]}>Entre na sua conta (aba Conta) para salvar listas.</Text>
      )}
    </ScrollView>
  );
}
