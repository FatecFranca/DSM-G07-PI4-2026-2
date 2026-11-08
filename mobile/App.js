import React, { useState } from 'react';
import { Platform, Pressable, StatusBar as BarraNativa, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Provedores, useCarrinho } from './src/estado';
import { cores } from './src/ui';
import Buscar from './src/telas/Buscar';
import Carrinho from './src/telas/Carrinho';
import Painel from './src/telas/Painel';
import Conta from './src/telas/Conta';

const ABAS = [
  ['buscar', '🔎', 'Buscar'],
  ['carrinho', '🛒', 'Carrinho'],
  ['painel', '📡', 'Painel IoT'],
  ['conta', '👤', 'Conta'],
];

function Principal() {
  const [aba, setAba] = useState('buscar');
  const { quantidade } = useCarrinho();
  return (
    <View style={{ flex: 1, backgroundColor: '#fff', paddingTop: Platform.OS === 'android' ? BarraNativa.currentHeight || 28 : 50 }}>
      <StatusBar style="dark" />
      <View style={estilos.topo}>
        <View style={estilos.marca}><Text style={{ color: '#fff', fontWeight: '900' }}>B</Text></View>
        <Text style={{ fontSize: 20, fontWeight: '900', color: cores.verdeEscuro }}>BAC</Text>
      </View>
      <View style={{ flex: 1 }}>
        {aba === 'buscar' && <Buscar />}
        {aba === 'carrinho' && <Carrinho />}
        {aba === 'painel' && <Painel irParaConta={() => setAba('conta')} />}
        {aba === 'conta' && <Conta />}
      </View>
      <View style={estilos.barra}>
        {ABAS.map(([id, icone, rotulo]) => (
          <Pressable key={id} style={estilos.aba} onPress={() => setAba(id)}>
            <Text style={{ fontSize: 20 }}>{icone}{id === 'carrinho' && quantidade > 0 ? ` ${quantidade}` : ''}</Text>
            <Text style={{ fontSize: 11, fontWeight: '700', color: aba === id ? cores.verdeEscuro : cores.suave }}>{rotulo}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export default function App() {
  return (
    <Provedores>
      <Principal />
    </Provedores>
  );
}

const estilos = StyleSheet.create({
  topo: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: cores.borda, backgroundColor: '#fff' },
  marca: { width: 28, height: 28, borderRadius: 8, backgroundColor: cores.verde, alignItems: 'center', justifyContent: 'center' },
  barra: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: cores.borda, backgroundColor: '#fff', paddingBottom: Platform.OS === 'ios' ? 20 : 6 },
  aba: { flex: 1, alignItems: 'center', paddingVertical: 8 },
});
