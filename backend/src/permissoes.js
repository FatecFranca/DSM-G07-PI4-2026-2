import { erro } from './util.js';

export function exigirMercado(usuario, mercadoId) {
  const id = Number(mercadoId);
  if (usuario.papel === 'ADMIN') return id;
  if (usuario.papel === 'MERCADO' && usuario.mercado_id === id) return id;
  throw erro(403, 'Este recurso pertence a outro supermercado');
}
