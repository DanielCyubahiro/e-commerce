import type { ContainerHolder } from './postgres-container';

export default async function globalTeardown(): Promise<void> {
  await (globalThis as ContainerHolder).__POSTGRES_CONTAINER__?.stop();
}
