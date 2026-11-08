import { rotasCatalogo } from './rotas/catalogo.js';
import { rotasUsuarios } from './rotas/usuarios.js';
import { rotasIot } from './rotas/iot.js';
import { rotasEstatisticas } from './rotas/estatisticas.js';
import { gerarOpenApi, paginaSwagger } from './openapi.js';
import { pagina } from './http.js';

const rotasNegocio = [...rotasCatalogo, ...rotasUsuarios, ...rotasIot, ...rotasEstatisticas];
const especificacao = gerarOpenApi(rotasNegocio);

export const todasAsRotas = [
  ...rotasNegocio,
  { metodo: 'GET', caminho: '/api/openapi.json', tag: 'Sistema', resumo: 'Especificação OpenAPI', handler: () => especificacao },
  { metodo: 'GET', caminho: '/api/docs', tag: 'Sistema', resumo: 'Documentação interativa (Swagger UI)', handler: () => pagina(paginaSwagger) },
];
