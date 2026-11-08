import { useEffect, useState } from 'react';

function lerHash() {
  const bruto = window.location.hash.replace(/^#/, '') || '/';
  const [caminho, busca = ''] = bruto.split('?');
  return { caminho: caminho || '/', query: new URLSearchParams(busca) };
}

export function useRota() {
  const [rota, setRota] = useState(lerHash);
  useEffect(() => {
    const aoMudar = () => {
      setRota(lerHash());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', aoMudar);
    return () => window.removeEventListener('hashchange', aoMudar);
  }, []);
  return rota;
}

export const ir = (para) => {
  window.location.hash = para;
};

export function Link({ para, children, ...resto }) {
  return (
    <a href={`#${para}`} {...resto}>
      {children}
    </a>
  );
}

function casar(padrao, caminho) {
  const a = padrao.split('/').filter(Boolean);
  const b = caminho.split('/').filter(Boolean);
  if (a.length !== b.length) return null;
  const params = {};
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith(':')) params[a[i].slice(1)] = decodeURIComponent(b[i]);
    else if (a[i] !== b[i]) return null;
  }
  return params;
}

export function Rotas({ tabela, rota, naoEncontrada }) {
  for (const [padrao, Pagina] of tabela) {
    const params = casar(padrao, rota.caminho);
    if (params) return <Pagina key={rota.caminho} params={params} query={rota.query} />;
  }
  return naoEncontrada;
}
