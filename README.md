# Quantam

A lightweight async workflow engine that lets developers compose, run, and control complex task pipelines with retries, parallel execution, timeouts, and cancellation using a simple fluent API.

## The Problem

Writing reliable async code is hard. Without a framework, you end up with:

- **Messy Promise chains** — impossible to read after 3 levels
- **Nested try/catch** — error handling scattered everywhere
- **Broken retries** — manual retry logic that fails silently
- **Race conditions** — concurrent tasks stepping on each other
- **No cancellation** — long-running jobs can't be stopped
- **Lost context** — data and state disappear between steps
- **Non-deterministic behavior** — same input, different output

## The Solution

Quantam gives you one clean, powerful API:

```typescript
const result = await quantam()
  .step(fetchUser)
  .step(enrichUserData)
  .parallel([saveToCache, logAnalytics])
  .retry(3)
  .timeout(5000)
  .run(userId);
```

## Features

- ✅ **Fluent API** — read like prose, write like a plan
- ✅ **Step-by-step execution** — functions run in order with data flowing between them
- ✅ **Parallel execution** — run multiple steps concurrently with `parallel()`
- ✅ **Automatic retries** — built-in exponential backoff with `retryCount` in context
- ✅ **Timeouts** — enforce SLA with global or per-step limits
- ✅ **Cancellation** — AbortController integration for clean shutdown or `withSignal()`
- ✅ **Batch processing** — run many inputs efficiently with `runMany()`
- ✅ **Error propagation** — catch errors once at the end
- ✅ **Deterministic** — same input always produces same behavior
- ✅ **Testable** — mock steps, assert flows

## Install

```bash
npm install quantam-async
```

## Quick Start

```typescript
import { quantam } from 'quantam-async';

// Define your async functions
async function fetchUser(id: string) {
  return { id, name: 'Alice' };
}

async function fetchOrders(user: any) {
  return { user, orders: [1, 2, 3] };
}

async function enrichData(data: any) {
  return { ...data, enriched: true };
}

// Compose and run
const result = await quantam()
  .step(fetchUser)
  .step(fetchOrders)
  .step(enrichData)
  .run('user-123');

console.log(result);
// { user: { id: 'user-123', name: 'Alice' }, orders: [...], enriched: true }
```

## Core API

### `quantam()`

Creates a new flow.

```typescript
const flow = quantam();
```

### `.step(fn)`

Add a single async step. Each step receives the output of the previous step.

```typescript
flow.step(async (input) => { /* process */ return output; })
```

### `.parallel(fns)`

Run multiple steps concurrently. All functions receive the same input. Results are collected in an array.

```typescript
flow.parallel([
  async (input) => { /* task A */ },
  async (input) => { /* task B */ },
])
```

### `.retry(count, delayMs?)`

Retry the last step on failure with exponential backoff.

```typescript
flow.retry(3, 100); // Retry 3 times, start with 100ms delay
```

### `.timeout(ms)`

Enforce a timeout on the entire pipeline.

```typescript
flow.timeout(5000); // 5 second limit
```

### `.stepTimeout(ms)`

Apply a timeout only to the most recent step.

```typescript
flow
  .step(fetchUser)
  .stepTimeout(200); // only this step is limited to 200ms
```

### `.name(label)`

Assign a name to the most recent step for better error messages and debugging.

```typescript
flow
  .step(validateInput)
  .name('validateInput')
  .step(processData)
  .name('processData');

// If validateInput fails, error will include "(at step 'validateInput')"
// The step name is also available in the context: context.stepName
```

### `.withSignal(signal)`

Bind an AbortSignal to the flow for reuse.

```typescript
const controller = new AbortController();

const flow = quantam()
  .withSignal(controller.signal)
  .step(longTask);
```

### `.run(input)`

Execute the pipeline with the given input. Returns a Promise.

```typescript
const result = await flow.run(data);
```

### `.runMany(inputs, options?)`

Run the same flow for many inputs with optional concurrency control.

```typescript
const inputs = Array.from({ length: 100000 }, (_, i) => i);
const results = await flow.runMany(inputs, { concurrency: 512 });
```

## Error Handling

Errors bubble up to a single promise rejection:

```typescript
try {
  const result = await quantam()
    .step(riskyOperation)
    .run(input);
} catch (error) {
  console.error('Pipeline failed:', error.message);
}
```

## Cancellation

Abort a running pipeline:

```typescript
const controller = new AbortController();

const promise = quantam()
  .step(longTask)
  .run(input, { signal: controller.signal });

// Later...
controller.abort();
```

## Version

**v0.1.1** — Added step naming for better error messages and debugging.
**v0.1.0** — Core features only. API subject to change.

## License

MIT
