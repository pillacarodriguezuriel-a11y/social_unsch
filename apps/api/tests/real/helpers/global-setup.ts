import { startTestContainers } from './test-environment';

export default async function globalSetup(): Promise<void> {
  console.log('\n========================================================');
  console.log('[Jest Global Setup]: Iniciando suite de pruebas reales');
  console.log('========================================================');
  await startTestContainers();
}
