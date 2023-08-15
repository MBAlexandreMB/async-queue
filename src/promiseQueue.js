const { singletonAnnouncer } = require('./Announcer');
const ProcessorsPool = require('./ProcessorsPool');
const { announce } = require('./queue.events');
const Subscriber = require('./Subscriber');
const uniqueId = require('./uniqueId');

class PromiseQueue {
  // Can be set to return a stream or JSON
  // Should be able to try again (as first or last in the queue)
  // Accepts callbacks to handle errors / check if it should try again
  // User can set if there is time between promises or batches
  // User can set a "X number of promises" in "T time" (max of 10 promises every 20s)
  // Can be set to be constantly hearing for new promises (or should it be the default and have a "stop" method?)

  #queue = [];

  constructor(options) {
    this.stopWhenFinished = false;
    this.announcer = singletonAnnouncer;
    this.paused = true;
    this.processorsPool = new ProcessorsPool();
    this.settledPromises = {};
    this.resolvedPromises = {};
    this.rejectedPromises = {};
    this.failedFirst = options?.failedFirst ?? false;
    this.maxRetries = options?.maxRetries ?? 0;
  }

  //! When adding a new promise, it should check if the queuer is unpaused
  //! If it is, it needs to trigger the process again
  /**
   * 
   * @param {Function} promiseCallback A function that returns the promise to be added to the queue to run
   * @param {string} description Any string to be saved with the promise for future use by the user
   * @param {string} identifier An identifier to be used as key in the resolved promises object
   * 
   * @returns {Subscriber | null} The id of the queued promise. If value provided is not a function, returns null;
   */
  add(promiseCallback, description, identifier, resultCallback) {
    if (!(promiseCallback instanceof Function)) return null;

    let id = identifier;

    if (!id) {
      id = uniqueId();
    }

    const subscriber = new Subscriber(this.announcer, id);

    if (resultCallback) {
      subscriber.on(id, resultCallback);
    }

    const promise = {
      id,
      action: promiseCallback,
      description,
      retries: 0,
    };

    this.#queue.push(promise);

    announce.addedPromise(null, promise);

    // if (!this.stopWhenFinished && this.paused) {

    // }

    return subscriber;
  }

  /**
   * @param {string} promiseId
   * @returns {number} The number of removed promises from the queue
   * 
   * @description
   * Removes all promises with provided promiseId from the queue
   */
  remove(promiseId) {
    const filteredQueue = this.#queue.filter((item) => item.id !== promiseId);
    const removedPromises = this.#queue.length - filteredQueue.length;
    this.#queue = filteredQueue;
    
    return removedPromises;
  }

  /**
   * @returns {number} The number of removed promises from the queue
   * 
   * @description
   * Removes all promises from the queue
   */
  clear() {
    const removedPromises = this.#queue.length;
    this.#queue = [];

    return removedPromises;
  }

  pause(pauseExecution = false, reAddToQueue = true) {
    if (this.paused) return;
    this.paused = true;

    if (pauseExecution) {
      const runningProcessors = [...this.processorsPool.runningProcessors];
      runningProcessors.forEach((processor) => {
        const stoppedPromise = processor.stop();
        reAddToQueue && this.#queue.push(stoppedPromise);
      });
    }
  }

  stop() {
    this.pause(true, false);
    const removedPromises = this.clear();
    
    return removedPromises;
  }

  resume() {
    if (!this.paused) return;
    this.paused = false;

    const processorsToResume = this.processorsPool.emptyCount;
    for (let i = 0; i < processorsToResume; i += 1) {
      this.#next();
    }
  }

  /**
   * @param {number} maxParallelPromises Number of promises to be called at the same time
   * @description
   * Starts running the promises
   */
  run(maxParallelPromises) {
    if (maxParallelPromises || this.processorsPool.size === 0) {
      this.processorsPool.provisionProcessors(maxParallelPromises);
    }

    this.resume();
  }

  //! When it ends, it should check if it should wait or send an end event
  /**
   * @description Sets the next empty processor to run the next promise in the queue, if there is any
   */
  async #next() {
    if (this.paused) return;

    if (this.#queue.length === 0) {
      // this.finish();
      return;
    }

    const promise = this.#queue.shift();
    const { id } = promise;

    const processor = await this.processorsPool.getNextEmptyProcessor();

    try {
      const result = await processor.run(promise);

      if (this.paused && this.pauseExecution) return;

      promise.data = result;
  
      delete promise.error;
      this.resolvedPromises[id] = promise;
    } catch (error) {
      promise.error = error;
      this.retry(promise);
    } finally {
      this.announcer.emit(id, promise.error, promise.data);
      this.settledPromises[id] = promise;
      //! Shouldn't be another function to decide if another promise should be called?
      this.#next();
    }
  }

  retry(promise) {
    promise.retries += 1;

    console.log('------------ RETRY -------------------');
    
    if (promise.retries > this.maxRetries) {
      this.rejectedPromises[promise.id] = promise;
      return;
    }
    
    if (this.failedFirst) {
      this.#queue.unshift(promise);
    } else {
      this.#queue.push(promise);
    }
    console.log({ promise });
    console.log('------------ END RETRY -------------------');
  }

  finish() {
    if (this.stopWhenFinished) {
      this.stop();
    }
  }

  get promiseQueue() {
    // queue object have function references in it and, therefore,
    // can't be copied using structuredClone native function
    return JSON.parse(JSON.stringify(this.#queue));
  }
}

//! Create factory to handle singleton contructor values
const PromiseQueueSingleton = new PromiseQueue();

module.exports = { PromiseQueue, PromiseQueueSingleton };



// module.exports = class PromiseScheduler {
//   #queue = [];
//   #resolveScheduler;

//   constructor(options = {}) {
//     const {
//       delayTimeInMS,
//       maxRetries,
//       onMaxRetriesReached,
//       failedGoesFirst
//     } = options;

//     this.totalAddedPromises = 0;
//     this.promisesRunning = {};
//     this.emptyProcessors = [];
//     this.resolvedPromises = {};
//     this.rejectedPromises = {};
//     this.paused = true;
//     this.delayTimeInMS = delayTimeInMS ?? 1000;
//     this.maxRetries = maxRetries ?? 3;
//     this.onMaxRetriesReached = onMaxRetriesReached;
//     this.failedGoesFirst = failedGoesFirst ?? false;
//   }

//   /**
//    * @param {number} parallelPromises Number of promises to be called at the same time
//    * @description
//    * Starts running the promises
//    */
//   run(parallelPromises = 1) {
//     this.paused = false;

//     for (let i = 0; i < parallelPromises; i++) {
//       this.promisesRunning[i] = null;
//       this.emptyProcessors.push(i);
//       this.next();
//     }

    
//     return new Promise((resolve) => {
//       this.#resolveScheduler = resolve.bind(resolve);
//       if (this.totalAddedPromises === 0) {
//         this.finish();
//       }
//     });
//   }

//   pause() {
//     this.paused = true;
//   }

//   resume() {
//     this.paused = false;
//     [...this.emptyProcessors].forEach(() => this.next());
//   }

//   /**
//    * @description
//    * 
//    */
//   stop() {
//     this.promisesRunning = {};
//     this.paused = true;
//   }

//   finish() {
//     const settledPromises = {
//       ...this.resolvedPromises,
//       ...this.rejectedPromises,
//     };

//     const totalSettledPromises = Object.entries(settledPromises).length;
//     if (this.totalAddedPromises === totalSettledPromises) {
//       this.clear();
//       this.#resolveScheduler({
//         resolved: this.resolvedPromises,
//         rejected: this.rejectedPromises
//       });
//     }
//   }

//   next() {
//     if (!this.paused && this.emptyProcessors.length > 0 && this.#queue.length > 0) {
//       const nextProcessor = this.emptyProcessors.shift();
//       const nextPromise = this.#queue.shift();

//       nextPromise.processorId = nextProcessor;
//       this.runProcessor(nextPromise, nextProcessor);
//     }
//   }

//   runProcessor(promise, processorId) {
//     this.promisesRunning[processorId] = promise;

//     promise.action()
//       .then((result) => {
//         this.resolvedPromises[promise.id] = result;
//         this.settlePromise(processorId);
//         this.next();

//         return result;
//       })
//       .catch(error => this.handleError(processorId, error));
//   }

//   settlePromise(processorId) {
//     this.promisesRunning[processorId] = null;
//     this.emptyProcessors.push(processorId);
//     this.finish();
//   }

//   delay() {
//     this.pause();
//     setTimeout(async () => {
//       await Promise.allSettled(Object.values(this.promisesRunning));
//       this.resume();
//     }, this.delayTimeInMS);
//   }

//   handleError(processorId, error) {
//     const currentPromise = this.promisesRunning[processorId];

//     if (!currentPromise) return;

//     const promiseToRetry = {
//       ...currentPromise,
//       retries: currentPromise.retries + 1,
//     };

//     // Do not reinsert promise
//     if (promiseToRetry.retries > this.maxRetries) {
//       this.rejectedPromises[currentPromise.id] = currentPromise;
//       this.onMaxRetriesReached?.(currentPromise);
//       this.finish();
//     }
    
//     if (this.failedGoesFirst) {
//       this.#queue.unshift(promiseToRetry);
//     } else {
//       this.#queue.push(promiseToRetry);
//     }

//     this.settlePromise(processorId);
//     this.delay(processorId);
//   }
// };

// ------------- Testing it ----------------
const axios = require('axios');
const NUMBER_OF_PROMISES = 100;
const PROMISE_MAX_RUNTIME = 5;
const FAIL_EVERY = 5;
const results = [];

const promiseScheduler = new PromiseQueue({
  // delayTimeInMS: 2000,
  maxRetries: 2,
  // onMaxRetriesReached: (value) => console.log(value),
  // failedFirst: true,
});

const handleResult = (error, data) => {
  if (!data && error) {
    promiseScheduler.pause(true, true);

    setTimeout(() => {
      promiseScheduler.resume();
    }, 2000);

    if (error.code === 'ERR_CANCELED') return;

    console.log('Error:', error.code, error?.response?.data?.number);
  }

  if (data) {
    results.push(data);
    results.sort((a, b) => a - b);
    console.log('Result:', data);
    console.log(results);
  }
};

for (let i = 1; i <= NUMBER_OF_PROMISES; i++ ) {
  // if (i % FAIL_EVERY === 0) {
  //   promiseScheduler.add(async ({ signal }) => {
  //     try {
  //       const response = await axios.post('http://localhost:3000/?forceFail=true', { number: i }, { signal });
  
  //       return response.data.number;
  //     } finally {
  //       setTimeout(() => {
  //         promiseScheduler.pause(true);
  //       }, 0);
  
  //       setTimeout(() => {
  //         promiseScheduler.resume();
  //       }, 2000);
  //     }
  //   }, i, `p-fail${i}`, handleResult);
  //   continue;
  // }

  promiseScheduler.add(async ({ signal }) => {
    const response = await axios.post('http://localhost:3000/?timeInMs=0', { number: i }, { signal });

    return response.data.number;
  }, i, `p-success v${i}`, handleResult);
}

// promiseScheduler.promiseQueue.forEach(p => console.log(p));
console.log('--------------------- EXECUTION ---------------------');
promiseScheduler.run(10);
// promiseScheduler.run(5).then(result => console.log(result));

// // TODO ADD reason for rejection
// // TODO ADD condition to retry