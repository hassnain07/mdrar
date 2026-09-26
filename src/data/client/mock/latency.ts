const LATENCY = Number(import.meta.env.VITE_MOCK_LATENCY_MS ?? 0);
const FAILURE_RATE = Number(import.meta.env.VITE_MOCK_FAILURE_RATE ?? 0);

export async function simulate(): Promise<void> {
  if (LATENCY > 0) await new Promise((r) => setTimeout(r, LATENCY));
  if (FAILURE_RATE > 0 && Math.random() < FAILURE_RATE) {
    throw { code: 'NETWORK', message: 'Simulated network failure' };
  }
}
