// Type definitions for fluent-logger-node
// Project: https://github.com/fluent/fluent-logger-node
// Definitions by: navono <https://github.com/navono>
// Definitions: https://github.com/fluent/fluent-logger-node

/// <reference types="node" />

import { Transform } from 'winston-transport';

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
    username: string;
    password: string;
  }

  class FluentSender {
    constructor(tagPrefix: string, options: Options);

    public emit(...args: string[]): void;
    public end(label: string, data: any, callback: () => void): void;
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
    new(options: U) : T;
  }

  let support: {
    winstonTransport: () => Constructable<FluentTransport, Options>
  };

  let EventTime: InnerEventTime;
  
  function configure(tag: string, options: Options): void;
  function createFluentSender(tag: string, options: Options): FluentSender;
}

export = fluentLogger;
