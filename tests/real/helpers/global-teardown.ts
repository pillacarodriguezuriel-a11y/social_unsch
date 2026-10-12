import { stopTestContainers } from './test-environment';

export default async function globalTeardown(): Promise<void> {
  console.log('\n========================================================');
  console.log('[Jest Global Teardown]: Finalizando suite de pruebas reales');
  console.log('========================================================');
  await stopTestContainers();
}
