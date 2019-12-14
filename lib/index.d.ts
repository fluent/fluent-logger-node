// Type definitions for fluent-logger-node
// Project: https://github.com/fluent/fluent-logger-node
// Definitions by: navono <https://github.com/navono>
// Definitions: https://github.com/fluent/fluent-logger-node

/// <reference types="node" />

import { Writable } from 'stream';

declare namespace fluentLogger {
  interface Options {
    eventMode?: string;
    host?: string;
    port?: number;
    path?: string;
    timeout?: number;
    tls?: any;
    tlsOptions?: any;
    reconnectInterval?: number;
    requireAckResponse?: boolean;
    ackResponseTimeout?: number;
    milliseconds?: number;
    flushInterval?: number;
    sendQueueSizeLimit?: number;
    security?: Security;
    internalLogger?: Logger;
  }

  interface Security {
    clientHostname: string;
    sharedKey: string;
    username?: string;
    password?: string;
  }

  interface StreamOptions {
    label?: string;
    encoding?: string;
  }

  interface Logger {
    info: LogFunction;
    error: LogFunction;
    [other: string]: any;
  }

  interface LogFunction {
    (message: any, data?: any, ...extra: any[]): any
  }

  type Timestamp = number | Date;
  type Callback = (err?: Error) => void;

  class FluentSender<T> {
      constructor(tagPrefix: string, options: Options);

      emit(data: T, callback?: Callback): void;
      emit(data: T, timestamp: Timestamp, callback?: Callback): void;
      emit(label: string, data: T, callback?: Callback): void;
      emit(label: string, data: T, timestamp: Timestamp, callback?: Callback): void;
      end(label: string, data: T, callback: Callback): void;
      toStream(label: string): Writable;
      toStream(opt: StreamOptions): Writable;
  }

  class InnerEventTime {
    epoch: number;
    nano: string;

    constructor(epoch: number, nano: number);

    static pack(eventTime: InnerEventTime): Buffer;
    static unpack(buffer: Buffer): InnerEventTime;
    static now(): InnerEventTime;
    static fromDate(date: Date): InnerEventTime;
    static fromTimestamp(t: number): InnerEventTime;
  }

  let support: {
    winstonTransport: any
  };

  let EventTime: InnerEventTime;

  function configure(tag: string, options: Options): void;
  function createFluentSender<T>(tag: string, options: Options): FluentSender<T>;

  function emit<T>(data: T, callback?: Callback): void;
  function emit<T>(data: T, timestamp: Timestamp, callback?: Callback): void;
  function emit<T>(label: string, data: T, callback?: Callback): void;
  function emit<T>(label: string, data: T, timestamp: Timestamp, callback?: Callback): void;
  function end<T>(label: string, data: T, callback: Callback): void;

  function on(event: string | symbol, listener: (...args: any[]) => void): void;
  function once(event: string | symbol, listener: (...args: any[]) => void): void;
  function removeListener(event: string | symbol, listener: (...args: any[]) => void): void;
  function removeAllListeners(event?: string | symbol): void;
  function setMaxListeners(n: number): void;
  function getMaxListeners(): number;
}

export = fluentLogger;
