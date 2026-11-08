const { spawn, execSync } = require('node:child_process');
const path = require('node:path');

const raiz = path.resolve(__dirname, '..');
const caminho = (...p) => path.join(raiz, ...p);

function exigirNode() {
  const [maior, menor] = process.versions.node.split('.').map(Number);
  if (maior < 22 || (maior === 22 && menor < 13)) {
    console.error(`\nNode.js ${process.versions.node} é muito antigo. Instale a versão LTS mais recente em https://nodejs.org e tente de novo.\n`);
    process.exit(1);
  }
}

function executarSincrono(comando, pasta) {
  execSync(comando, { cwd: pasta, stdio: 'inherit' });
}

const filhos = [];

function iniciar(comando, args, opcoes = {}) {
  const filho = opcoes.shell
    ? spawn(comando, { stdio: 'inherit', shell: true, ...opcoes })
    : spawn(comando, args, { stdio: 'inherit', ...opcoes });
  filhos.push(filho);
  return filho;
}

function encerrarTudo() {
  for (const f of filhos) {
    if (f.exitCode !== null || !f.pid) continue;
    try {
      if (process.platform === 'win32') execSync(`taskkill /pid ${f.pid} /T /F`, { stdio: 'ignore' });
      else f.kill('SIGTERM');
    } catch {}
  }
}

process.on('SIGINT', () => {
  encerrarTudo();
  process.exit(0);
});
process.on('SIGTERM', () => {
  encerrarTudo();
  process.exit(0);
});
process.on('exit', encerrarTudo);

module.exports = { raiz, caminho, exigirNode, executarSincrono, iniciar, encerrarTudo };
