import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const PORTA = Number(process.env.PORT || 3333);
export const DIR_DADOS = process.env.BAC_DADOS || path.join(raiz, 'data');
export const ARQUIVO_BANCO = process.env.BAC_BANCO || path.join(DIR_DADOS, 'bac.db');
export const ARQUIVO_CHAVES = path.join(DIR_DADOS, 'chaves-iot.json');
export const DIR_WEB = path.resolve(raiz, '..', 'web', 'dist');
export const LIMITE_OFFLINE_MS = 20000;
