import { quantam } from './index';

async function main() {
  const size = 100000;
  const inputs = Array.from({ length: size }, (_, i) => i);
  const flow = quantam<number>().step(async (n) => n + 1);
  const start = Date.now();
  const results = await flow.runMany(inputs, { concurrency: 512 });
  const durationMs = Date.now() - start;
  const opsPerSec = durationMs > 0 ? size / (durationMs / 1000) : 0;

  console.log(
    JSON.stringify({
      size,
      concurrency: 512,
      durationMs,
      opsPerSec,
      first: results[0],
      last: results[results.length - 1],
    }),
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

