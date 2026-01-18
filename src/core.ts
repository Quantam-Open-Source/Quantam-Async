/**
 * Quantam Core Implementation
 * Fluent API for composing async pipelines
 */

import { AsyncFn, Flow, FlowOptions, ExecutionContext } from './types';

interface Step {
  type: 'single' | 'parallel';
  fn?: AsyncFn;
  fns?: AsyncFn[];
  retries?: number;
  retryDelay?: number;
  timeout?: number;
  name?: string;
}

export class Quantam<T = any> implements Flow<T> {
  private steps: Step[] = [];
  private timeoutMs?: number;
  private abortSignal?: AbortSignal;

  step<R>(fn: AsyncFn<T, R>): Quantam<R> {
    const newFlow = new Quantam<R>();
    newFlow.steps = [...this.steps];
    newFlow.timeoutMs = this.timeoutMs;
    newFlow.abortSignal = this.abortSignal;
    newFlow.steps.push({ type: 'single', fn });
    return newFlow;
  }

  parallel<R>(fns: AsyncFn<T, any>[]): Quantam<R[]> {
    const newFlow = new Quantam<R[]>();
    newFlow.steps = [...this.steps];
    newFlow.timeoutMs = this.timeoutMs;
    newFlow.abortSignal = this.abortSignal;
    newFlow.steps.push({ type: 'parallel', fns });
    return newFlow;
  }

  name(label: string): Quantam<T> {
    const newFlow = new Quantam<T>();
    newFlow.steps = [...this.steps];
    newFlow.timeoutMs = this.timeoutMs;
    newFlow.abortSignal = this.abortSignal;

    if (newFlow.steps.length > 0) {
      const lastStep = newFlow.steps[newFlow.steps.length - 1];
      lastStep.name = label;
    }

    return newFlow;
  }

  retry(count: number, delayMs: number = 100): Quantam<T> {
    const newFlow = new Quantam<T>();
    newFlow.steps = [...this.steps];
    newFlow.timeoutMs = this.timeoutMs;
    newFlow.abortSignal = this.abortSignal;

    if (newFlow.steps.length > 0) {
      const lastStep = newFlow.steps[newFlow.steps.length - 1];
      lastStep.retries = count;
      lastStep.retryDelay = delayMs;
    }

    return newFlow;
  }

  stepTimeout(ms: number): Quantam<T> {
    const newFlow = new Quantam<T>();
    newFlow.steps = [...this.steps];
    newFlow.timeoutMs = this.timeoutMs;
    newFlow.abortSignal = this.abortSignal;

    if (newFlow.steps.length > 0) {
      const lastStep = newFlow.steps[newFlow.steps.length - 1];
      lastStep.timeout = ms;
    }

    return newFlow;
  }

  withSignal(signal: AbortSignal): Quantam<T> {
    const newFlow = new Quantam<T>();
    newFlow.steps = [...this.steps];
    newFlow.timeoutMs = this.timeoutMs;
    newFlow.abortSignal = signal;
    return newFlow;
  }

  timeout(ms: number): Quantam<T> {
    const newFlow = new Quantam<T>();
    newFlow.steps = [...this.steps];
    newFlow.timeoutMs = ms;
    newFlow.abortSignal = this.abortSignal;
    return newFlow;
  }

  async runMany(inputs: T[], options?: FlowOptions & { concurrency?: number }): Promise<T[]> {
    const configuredConcurrency = options?.concurrency;
    const concurrency = configuredConcurrency != null ? configuredConcurrency : inputs.length;
    if (inputs.length === 0) {
      return [];
    }

    if (concurrency <= 0 || concurrency >= inputs.length) {
      return Promise.all(inputs.map((input) => this.run(input, options)));
    }

    const results: T[] = new Array(inputs.length);
    let index = 0;
    const worker = async () => {
      while (true) {
        const currentIndex = index++;
        if (currentIndex >= inputs.length) {
          break;
        }
        results[currentIndex] = await this.run(inputs[currentIndex], options);
      }
    };

    const workers: Promise<void>[] = [];
    const workerCount = Math.min(concurrency, inputs.length);
    for (let i = 0; i < workerCount; i++) {
      workers.push(worker());
    }

    await Promise.all(workers);
    return results;
  }

  async run(input: T, options?: FlowOptions): Promise<T> {
    const signal = options?.signal || this.abortSignal;
    let result: any = input;
    const context: ExecutionContext = {
      signal,
      stepIndex: 0,
      retryCount: 0,
    };

    for (let i = 0; i < this.steps.length; i++) {
      this.checkAborted(signal);

      const step = this.steps[i];
      context.stepIndex = i;
      context.stepName = step.name;
      context.retryCount = 0;

      if (step.type === 'single' && step.fn) {
        result = await this.executeSingleStep(
          step.fn,
          result,
          context,
          step.retries || 0,
          step.retryDelay || 100,
          step.timeout,
        );
      } else if (step.type === 'parallel' && step.fns) {
        result = await this.executeParallelSteps(
          step.fns,
          result,
          context,
          step.retries || 0,
          step.retryDelay || 100,
          step.timeout,
        );
      }
    }

    return result;
  }

  private async executeSingleStep(
    fn: AsyncFn,
    input: any,
    context: ExecutionContext,
    retries: number,
    retryDelay: number,
    stepTimeout?: number,
  ): Promise<any> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        this.checkAborted(context.signal);
        context.retryCount = attempt;

        const promise = fn(input, context);
        const effectiveTimeout = stepTimeout ?? this.timeoutMs;
        const result = effectiveTimeout
          ? await Promise.race([
              promise,
              this.createTimeout(effectiveTimeout),
            ])
          : await promise;

        return result;
      } catch (error) {
        lastError = error as Error;

        if (attempt < retries) {
          const delay = retryDelay * (1 << attempt);
          await this.sleep(delay, context.signal);
        }
      }
    }

    if (lastError) {
      const stepLabel = context.stepName ? ` '${context.stepName}'` : '';
      if (stepLabel && !lastError.message.includes(stepLabel)) {
        lastError.message = `${lastError.message} (at step${stepLabel})`;
      }
      throw lastError;
    }
    
    const stepLabel = context.stepName ? ` '${context.stepName}'` : '';
    throw new Error(`Step${stepLabel} execution failed`);
  }

  private async executeParallelSteps(
    fns: AsyncFn[],
    input: any,
    context: ExecutionContext,
    retries: number,
    retryDelay: number,
    stepTimeout?: number,
  ): Promise<any[]> {
    const promises = fns.map((fn) =>
      this.executeSingleStep(fn, input, context, retries, retryDelay, stepTimeout),
    );

    return Promise.all(promises);
  }

  private checkAborted(signal?: AbortSignal): void {
    if (signal?.aborted) {
      throw new Error('Pipeline aborted');
    }
  }

  private createTimeout(ms: number): Promise<never> {
    return new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms),
    );
  }

  private sleep(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(resolve, ms);

      if (signal) {
        const onAbort = () => {
          clearTimeout(timeoutId);
          reject(new Error('Sleep aborted'));
        };
        if (signal.aborted) {
          onAbort();
          return;
        }
        signal.addEventListener('abort', onAbort, { once: true });
      }
    });
  }
}

export function quantam<T = any>(): Quantam<T> {
  return new Quantam<T>();
}
