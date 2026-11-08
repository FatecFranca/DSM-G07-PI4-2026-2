export const moeda = (v) => (v === null || v === undefined ? '—' : `R$ ${Number(v).toFixed(2).replace('.', ',')}`);

export const numero = (v, casas = 2) => (v === null || v === undefined || Number.isNaN(Number(v)) ? '—' : Number(v).toFixed(casas).replace('.', ','));

export const pct = (v, casas = 1) => (v === null || v === undefined ? '—' : `${numero(v * 100, casas)}%`);

export const hora = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  const dois = (n) => String(n).padStart(2, '0');
  return `${dois(d.getHours())}:${dois(d.getMinutes())}:${dois(d.getSeconds())}`;
};

export const dataCurta = (ms) => {
  const d = new Date(ms);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
};
