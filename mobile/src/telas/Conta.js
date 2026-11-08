import React, { useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TextInput, View } from 'react-native';
import { api, definirServidor, servidorAtual, servidorAutomatico } from '../api';
import { useAuth, useCarregar } from '../estado';
import { Aviso, Botao, estilos, Selo, cores } from '../ui';
import { moeda } from '../formatos';
import { ResultadoComparacao } from './Carrinho';

const DEMO = [
  ['Consumidor', 'user@gmail.com', 'user123'],
  ['Supermercado', 'savegnago@market.com', 'market123'],
  ['Administrador', 'admin@bac.com', 'admin123'],
];

function Servidor() {
  const [url, setUrl] = useState(servidorAtual() || '');
  const [msg, setMsg] = useState('');
  return (
    <View style={estilos.card}>
      <Text style={{ fontWeight: '800' }}>Servidor da API</Text>
      <Text style={estilos.suave}>Detectado automaticamente: {servidorAutomatico()}. Só altere se o app não conseguir conectar.</Text>
      <TextInput style={[estilos.input, { marginTop: 8 }]} value={url} onChangeText={setUrl} autoCapitalize="none" autoCorrect={false} placeholder="http://192.168.0.10:3333" />
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
        <View style={{ flex: 1 }}>
          <Botao pequeno titulo="Salvar" aoPressionar={async () => { await definirServidor(url); setMsg('Servidor atualizado.'); }} />
        </View>
        <View style={{ flex: 1 }}>
          <Botao pequeno tipo="claro" titulo="Usar automático" aoPressionar={async () => { await definirServidor(''); setUrl(servidorAtual()); setMsg('Voltou ao automático.'); }} />
        </View>
      </View>
      <Aviso texto={msg} tipo="ok" />
    </View>
  );
}

function Login() {
  const { entrar, cadastrar } = useAuth();
  const [modo, setModo] = useState('entrar');
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  const enviar = async () => {
    setEnviando(true);
    setErro('');
    try {
      if (modo === 'entrar') await entrar(email.trim(), senha);
      else await cadastrar(nome.trim(), email.trim(), senha);
    } catch (e) {
      setErro(e.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <View>
      <Text style={estilos.titulo}>{modo === 'entrar' ? 'Entrar' : 'Criar conta'}</Text>
      <Aviso texto={erro} />
      {modo === 'cadastro' && (
        <>
          <Text style={estilos.rotulo}>Nome</Text>
          <TextInput style={estilos.input} value={nome} onChangeText={setNome} />
        </>
      )}
      <Text style={estilos.rotulo}>E-mail</Text>
      <TextInput style={estilos.input} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
      <Text style={estilos.rotulo}>Senha</Text>
      <TextInput style={estilos.input} value={senha} onChangeText={setSenha} secureTextEntry />
      <View style={{ marginTop: 12 }}>
        <Botao titulo={enviando ? 'Aguarde...' : modo === 'entrar' ? 'Entrar' : 'Cadastrar'} desabilitado={enviando} aoPressionar={enviar} />
      </View>
      <View style={{ marginTop: 8 }}>
        <Botao tipo="claro" titulo={modo === 'entrar' ? 'Criar uma conta' : 'Já tenho conta'} aoPressionar={() => setModo(modo === 'entrar' ? 'cadastro' : 'entrar')} />
      </View>
      <Text style={[estilos.suave, { marginTop: 16 }]}>Contas de demonstração (toque para preencher):</Text>
      <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
        {DEMO.map(([r, e, s]) => (
          <View key={e} style={{ flex: 1 }}>
            <Botao pequeno tipo="claro" titulo={r} aoPressionar={() => { setModo('entrar'); setEmail(e); setSenha(s); }} />
          </View>
        ))}
      </View>
    </View>
  );
}

function Listas() {
  const listas = useCarregar(() => api.get('/listas'), []);
  const notificacoes = useCarregar(() => api.get('/notificacoes'), [], 10000);
  const favoritos = useCarregar(() => api.get('/favoritos'), []);
  const [resultado, setResultado] = useState(null);
  const [erro, setErro] = useState('');

  const otimizar = async (id) => {
    try {
      setResultado(await api.get(`/listas/${id}/otimizar`));
      setErro('');
    } catch (e) {
      setErro(e.message);
    }
  };

  return (
    <View>
      <Aviso texto={erro} />
      <Text style={estilos.subtitulo}>Minhas listas</Text>
      {!listas.dados ? <ActivityIndicator color={cores.verde} /> : listas.dados.length === 0 ? <Text style={estilos.suave}>Nenhuma lista salva ainda.</Text> : listas.dados.map((l) => (
        <View key={l.id} style={estilos.card}>
          <Text style={{ fontWeight: '800' }}>{l.nome}</Text>
          <Text style={estilos.suave}>{l.itens.map((i) => `${i.quantidade}× ${i.nome}`).slice(0, 3).join(', ')}{l.itens.length > 3 ? '...' : ''}</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
            <Botao pequeno titulo="⚡ Otimizar" aoPressionar={() => otimizar(l.id)} />
            <Botao pequeno tipo="claro" titulo="Excluir" aoPressionar={async () => { await api.del(`/listas/${l.id}`); if (resultado?.lista.id === l.id) setResultado(null); listas.recarregar(); }} />
          </View>
        </View>
      ))}
      {resultado && (
        <>
          <Text style={estilos.subtitulo}>Resultado: {resultado.lista.nome}</Text>
          <ResultadoComparacao r={resultado} />
        </>
      )}
      <Text style={estilos.subtitulo}>Favoritos</Text>
      {favoritos.dados?.length ? favoritos.dados.map((f) => (
        <View key={f.id} style={[estilos.card, estilos.linha]}>
          <Text style={{ flex: 1, fontWeight: '600' }}>{f.nome}</Text>
          <Text style={{ fontWeight: '800', color: cores.verdeEscuro }}>{moeda(f.menor_preco)}</Text>
        </View>
      )) : <Text style={estilos.suave}>Favorite produtos para ser avisado quando o preço cair.</Text>}
      <Text style={estilos.subtitulo}>Notificações</Text>
      {notificacoes.dados?.length ? notificacoes.dados.slice(0, 10).map((n) => (
        <View key={n.id} style={[estilos.card, !n.lida && { borderColor: cores.verde }]}>
          <Selo tipo={n.tipo === 'ALERTA_IOT' ? 'erro' : 'ok'}>{n.tipo === 'ALERTA_IOT' ? 'Alerta IoT' : 'Preço'}</Selo>
          <Text style={{ marginTop: 4 }}>{n.mensagem}</Text>
        </View>
      )) : <Text style={estilos.suave}>Sem notificações.</Text>}
      {notificacoes.dados?.length > 0 && <Botao pequeno tipo="claro" titulo="Marcar todas como lidas" aoPressionar={async () => { await api.post('/notificacoes/lidas'); notificacoes.recarregar(); }} />}
    </View>
  );
}

export default function Conta() {
  const { usuario, sair } = useAuth();
  return (
    <ScrollView style={estilos.tela} contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled">
      {usuario ? (
        <>
          <Text style={estilos.titulo}>Olá, {usuario.nome.split(' ')[0]}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={estilos.suave}>{usuario.email}</Text>
            <Selo>{usuario.papel}</Selo>
          </View>
          <View style={{ marginTop: 10, alignSelf: 'flex-start' }}>
            <Botao pequeno tipo="claro" titulo="Sair" aoPressionar={sair} />
          </View>
          <Listas />
        </>
      ) : (
        <Login />
      )}
      <Text style={estilos.subtitulo}>Conexão</Text>
      <Servidor />
    </ScrollView>
  );
}
