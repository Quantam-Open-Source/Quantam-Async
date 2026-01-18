import test from 'node:test';
import assert from 'node:assert/strict';
import { quantam } from '../index';

test('runs basic sequential pipeline', async () => {
  const flow = quantam<number>()
    .step(async (n) => n + 1)
    .step(async (n) => n * 2);

  const result = await flow.run(1);
  assert.equal(result, 4);
});

test('retries and exposes retryCount', async () => {
  let attempts = 0;

  const flow = quantam<number>()
    .step(async (n, ctx) => {
      attempts++;
      if ((ctx?.retryCount ?? 0) < 2) {
        throw new Error('transient');
      }
      return n + (ctx?.retryCount ?? 0);
    })
    .retry(3, 1);

  const result = await flow.run(1);
  assert.equal(result, 3);
  assert.equal(attempts, 3);
});

test('stepTimeout rejects slow step', async () => {
  const flow = quantam<number>()
    .step(async (n) => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      return n + 1;
    })
    .stepTimeout(5);

  let threw = false;
  try {
    await flow.run(1);
  } catch (err) {
    threw = true;
    assert.match((err as Error).message, /Timeout/);
  }
  assert.equal(threw, true);
});

test('runMany respects concurrency limit', async () => {
  const concurrencyLimit = 4;
  let inFlight = 0;
  let maxInFlight = 0;

  const flow = quantam<number>().step(async (n) => {
    inFlight++;
    if (inFlight > maxInFlight) {
      maxInFlight = inFlight;
    }
    await new Promise((resolve) => setTimeout(resolve, 5));
    inFlight--;
    return n + 1;
  });

  const inputs = Array.from({ length: 16 }, (_, i) => i);
  const results = await flow.runMany(inputs, { concurrency: concurrencyLimit });

  assert.deepEqual(
    results,
    inputs.map((n) => n + 1),
  );
  assert.ok(maxInFlight <= concurrencyLimit);
});

