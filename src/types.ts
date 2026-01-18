/**
 * Type definitions for Quantam
 */

export type AsyncFn<T = any, R = any> = (input: T, context?: ExecutionContext) => Promise<R>;

export interface ExecutionContext {
  signal?: AbortSignal;
  retryCount?: number;
  stepIndex?: number;
  stepName?: string;
}

export interface FlowOptions {
  signal?: AbortSignal;
}

export interface RunManyOptions extends FlowOptions {
  concurrency?: number;
}

export interface Flow<T = any> {
  step<R>(fn: AsyncFn<T, R>): Flow<R>;
  parallel<R>(fns: AsyncFn<T, any>[]): Flow<R[]>;
  name(label: string): Flow<T>;
  retry(count: number, delayMs?: number): Flow<T>;
  timeout(ms: number): Flow<T>;
  stepTimeout(ms: number): Flow<T>;
  withSignal(signal: AbortSignal): Flow<T>;
  run(input: T, options?: FlowOptions): Promise<T>;
   runMany(inputs: T[], options?: RunManyOptions): Promise<T[]>;
}

export interface QuantamConfig {
  retries?: number;
  retryDelay?: number;
  timeout?: number;
}
