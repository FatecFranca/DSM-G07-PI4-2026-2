import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, definirToken, iniciarApi } from './api';

const AuthContexto = createContext(null);
const CarrinhoContexto = createContext(null);

export const useAuth = () => useContext(AuthContexto);
export const useCarrinho = () => useContext(CarrinhoContexto);

export function Provedores({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [itens, setItens] = useState([]);
  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    (async () => {
      const { token } = await iniciarApi();
      try {
        const salvo = await AsyncStorage.getItem('bac_carrinho');
        if (salvo) setItens(JSON.parse(salvo));
      } catch {}
      if (token) {
        try {
          setUsuario(await api.get('/auth/perfil'));
        } catch {
          await definirToken(null);
        }
      }
      setPronto(true);
    })();
  }, []);

  useEffect(() => {
    if (pronto) AsyncStorage.setItem('bac_carrinho', JSON.stringify(itens)).catch(() => {});
  }, [itens, pronto]);

  const entrar = useCallback(async (email, senha) => {
    const r = await api.post('/auth/login', { email, senha });
    await definirToken(r.token);
    setUsuario(r.usuario);
  }, []);

  const cadastrar = useCallback(async (nome, email, senha) => {
    const r = await api.post('/auth/registro', { nome, email, senha });
    await definirToken(r.token);
    setUsuario(r.usuario);
  }, []);

  const sair = useCallback(async () => {
    await definirToken(null);
    setUsuario(null);
  }, []);

  const adicionar = useCallback((p) => {
    setItens((atual) => {
      if (atual.find((i) => i.id === p.id)) return atual.map((i) => (i.id === p.id ? { ...i, quantidade: i.quantidade + 1 } : i));
      return [...atual, { id: p.id, nome: p.nome, icone: p.icone, quantidade: 1 }];
    });
  }, []);
  const alterar = useCallback((id, delta) => setItens((a) => a.map((i) => (i.id === id ? { ...i, quantidade: Math.max(1, i.quantidade + delta) } : i))), []);
  const remover = useCallback((id) => setItens((a) => a.filter((i) => i.id !== id)), []);
  const limpar = useCallback(() => setItens([]), []);

  const auth = useMemo(() => ({ usuario, entrar, cadastrar, sair }), [usuario, entrar, cadastrar, sair]);
  const carrinho = useMemo(
    () => ({ itens, adicionar, alterar, remover, limpar, quantidade: itens.reduce((s, i) => s + i.quantidade, 0) }),
    [itens, adicionar, alterar, remover, limpar],
  );

  if (!pronto) return null;
  return (
    <AuthContexto.Provider value={auth}>
      <CarrinhoContexto.Provider value={carrinho}>{children}</CarrinhoContexto.Provider>
    </AuthContexto.Provider>
  );
}

export function useCarregar(funcao, dependencias, intervaloMs) {
  const [estado, setEstado] = useState({ dados: null, erro: null, carregando: true });
  const recarregar = useCallback(async () => {
    try {
      setEstado({ dados: await funcao(), erro: null, carregando: false });
    } catch (e) {
      setEstado((s) => ({ dados: s.dados, erro: e.message, carregando: false }));
    }
  }, dependencias);

  useEffect(() => {
    recarregar();
    if (!intervaloMs) return undefined;
    const id = setInterval(recarregar, intervaloMs);
    return () => clearInterval(id);
  }, [recarregar, intervaloMs]);

  return { ...estado, recarregar };
}
