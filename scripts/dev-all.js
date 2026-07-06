const { spawn } = require('child_process');

console.log('====================================================================');
console.log(' 🚀 INICIANDO ECOSISTEMA SOCIAL-UNSCH (BACKEND + FRONTEND) ');
console.log('====================================================================');

// Arranca el servidor Backend de Express en el puerto 3000
const backend = spawn('npm', ['run', 'dev:backend'], {
  stdio: 'inherit',
  shell: true
});

// Arranca el servidor Frontend de Next.js en el puerto 3001
const frontend = spawn('npm', ['run', 'dev:frontend'], {
  stdio: 'inherit',
  shell: true
});

// Captura el cierre de la terminal (Ctrl + C) para matar limpiamente ambos subprocesos
process.on('SIGINT', () => {
  console.log('\n[Orchestrator]: Deteniendo servidores de desarrollo de forma segura...');
  backend.kill('SIGINT');
  frontend.kill('SIGINT');
  process.exit(0);
});