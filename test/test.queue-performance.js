/* eslint-disable no-console */
'use strict';
/* globals describe, it */
/* eslint node/no-unpublished-require: ["error", {"allowModules": ["chai"]}] */
const expect = require('chai').expect;
const Queue = require('tiny-queue');

describe('queue performance', () => {
  it('should be more than 100 times faster than array for large lengths', () => {
    const array = [];
    const queue = new Queue();
    for (let i = 1; i < 100000; i++) {
      array.push(i);
      queue.push(i);
    }


    const startQueue = process.hrtime();
    while (queue.length > 0) {
      queue.shift();
    }
    const totalQueue = process.hrtime(startQueue);
    const startArray = process.hrtime();
    while (array.length > 0) {
      array.shift();
    }
    const totalArray = process.hrtime(startArray);

    console.log(`Array time: ${totalArray[0] + totalArray[1] / 1e9}`);
    console.log(`Queue time: ${totalQueue[0] + totalQueue[1] / 1e9}`);
    expect(totalArray[0] + totalArray[1] / 1e9 > (totalQueue[0] + totalQueue[1] / 1e9) * 100).to.be.true;
  });

  it('the time difference between array.shift and queue.shift should be irrelevant for small lengths', () => {
    const array = [];
    const queue = new Queue();
    for (let i = 1; i < 10000; i++) {
      array.push(i);
      queue.push(i);
    }


    const startQueue = process.hrtime();
    while (queue.length > 0) {
      queue.shift();
    }
    const totalQueue = process.hrtime(startQueue);
    const startArray = process.hrtime();
    while (array.length > 0) {
      array.shift();
    }
    const totalArray = process.hrtime(startArray);

    console.log(`Array time: ${totalArray[0] + totalArray[1] / 1e9}`);
    console.log(`Queue time: ${totalQueue[0] + totalQueue[1] / 1e9}`);
    expect(totalArray[0] + totalArray[1] / 1e9 - (totalQueue[0] + totalQueue[1] / 1e9) < 0.001).to.be.true;
  });
});