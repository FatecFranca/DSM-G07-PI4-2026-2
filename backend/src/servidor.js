import { criarServidor } from './http.js';
import { todasAsRotas } from './rotas.js';
import { semear, garantirArquivoChaves } from './dados-iniciais.js';
import { PORTA } from './config.js';

const [maior] = process.versions.node.split('.').map(Number);
if (maior < 22) {
  console.error(`Node.js ${process.versions.node} é muito antigo. Instale o Node.js 22 ou mais novo (https://nodejs.org).`);
  process.exit(1);
}

if (semear()) console.log('Banco criado com dados de demonstração.');
garantirArquivoChaves();

export const servidor = criarServidor(todasAsRotas);

servidor.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.error(`A porta ${PORTA} já está em uso. Feche o outro programa ou use PORT=3334.`);
    process.exit(1);
  }
  throw e;
});

servidor.listen(PORTA, '0.0.0.0', () => {
  console.log(`API BAC no ar: http://localhost:${PORTA}/api  |  documentação: http://localhost:${PORTA}/api/docs`);
});
