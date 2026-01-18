import { quantam } from '../index';

async function main(): Promise<void> {
  const flow = quantam<number>().step(async (n) => n + 1);

  const inputs: number[] = Array.from({ length: 1000 }, (_, i) => i);
  const results = await flow.runMany(inputs, { concurrency: 64 });

  console.log({
    length: results.length,
    first: results[0],
    last: results[results.length - 1],
  });
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

