// Type definitions for fluent-logger-node
// Project: https://github.com/fluent/fluent-logger-node
// Definitions by: navono <https://github.com/navono>
// Definitions: https://github.com/fluent/fluent-logger-node

/// <reference types="node" />

import { Transform } from 'winston-transport';
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

  class FluentTransport extends Transform {
    constructor(opt: Options);

    public log(info: string, callback: (err: Error, b: boolean) => void): any;
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

  interface Constructable<T, U> {
    new(tag: string, options: U) : T;
  }

  let support: {
    winstonTransport: () => Constructable<FluentTransport, Options>
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
