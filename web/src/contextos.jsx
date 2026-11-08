import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, guardarToken, lerToken } from './api.js';

const AuthContexto = createContext(null);
const CarrinhoContexto = createContext(null);

export const useAuth = () => useContext(AuthContexto);
export const useCarrinho = () => useContext(CarrinhoContexto);

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [carregando, setCarregando] = useState(!!lerToken());

  useEffect(() => {
    if (!lerToken()) return;
    api.get('/auth/perfil')
      .then(setUsuario)
      .catch(() => guardarToken(null))
      .finally(() => setCarregando(false));
  }, []);

  const entrar = useCallback(async (email, senha) => {
    const r = await api.post('/auth/login', { email, senha });
    guardarToken(r.token);
    setUsuario(r.usuario);
    return r.usuario;
  }, []);

  const cadastrar = useCallback(async (nome, email, senha) => {
    const r = await api.post('/auth/registro', { nome, email, senha });
    guardarToken(r.token);
    setUsuario(r.usuario);
    return r.usuario;
  }, []);

  const sair = useCallback(() => {
    guardarToken(null);
    setUsuario(null);
  }, []);

  const valor = useMemo(() => ({ usuario, carregando, entrar, cadastrar, sair }), [usuario, carregando, entrar, cadastrar, sair]);
  return <AuthContexto.Provider value={valor}>{children}</AuthContexto.Provider>;
}

function lerCarrinho() {
  try {
    return JSON.parse(localStorage.getItem('bac_carrinho')) || [];
  } catch {
    return [];
  }
}

export function CarrinhoProvider({ children }) {
  const [itens, setItens] = useState(lerCarrinho);

  useEffect(() => {
    try {
      localStorage.setItem('bac_carrinho', JSON.stringify(itens));
    } catch {}
  }, [itens]);

  const adicionar = useCallback((produto) => {
    setItens((atual) => {
      const existe = atual.find((i) => i.id === produto.id);
      if (existe) return atual.map((i) => (i.id === produto.id ? { ...i, quantidade: i.quantidade + 1 } : i));
      return [...atual, { id: produto.id, nome: produto.nome, imagem_url: produto.imagem_url, icone: produto.icone, quantidade: 1 }];
    });
  }, []);

  const alterar = useCallback((id, delta) => {
    setItens((atual) => atual.map((i) => (i.id === id ? { ...i, quantidade: Math.max(1, i.quantidade + delta) } : i)));
  }, []);

  const remover = useCallback((id) => setItens((atual) => atual.filter((i) => i.id !== id)), []);
  const limpar = useCallback(() => setItens([]), []);
  const quantidade = itens.reduce((s, i) => s + i.quantidade, 0);

  const valor = useMemo(() => ({ itens, adicionar, alterar, remover, limpar, quantidade }), [itens, adicionar, alterar, remover, limpar, quantidade]);
  return <CarrinhoContexto.Provider value={valor}>{children}</CarrinhoContexto.Provider>;
}

export function useCarregar(funcao, dependencias, intervaloMs) {
  const [estado, setEstado] = useState({ dados: null, erro: null, carregando: true });

  const recarregar = useCallback(async () => {
    try {
      const dados = await funcao();
      setEstado({ dados, erro: null, carregando: false });
    } catch (e) {
      setEstado((s) => ({ dados: s.dados, erro: e.message, carregando: false }));
    }
  }, dependencias);

  useEffect(() => {
    let ativo = true;
    setEstado((s) => ({ ...s, carregando: true }));
    recarregar();
    if (!intervaloMs) return undefined;
    const id = setInterval(() => ativo && recarregar(), intervaloMs);
    return () => {
      ativo = false;
      clearInterval(id);
    };
  }, [recarregar, intervaloMs]);

  return { ...estado, recarregar };
}
