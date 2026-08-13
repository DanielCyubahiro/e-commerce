import type { ContainerHolder } from './postgres-container';

/** Stops the container started by the integration globalSetup. */
export default async function globalTeardown(): Promise<void> {
  await (globalThis as ContainerHolder).__POSTGRES_CONTAINER__?.stop();
}
