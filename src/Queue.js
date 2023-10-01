const { singletonAnnouncer } = require("./Announcer");
const ProcessorsPool = require("./ProcessorsPool");
const { announce, ACTIONS } = require("./queue.events");
const Subscriber = require("./Subscriber");
const uniqueId = require("./uniqueId");

/**
 * @typedef {Object} QueueOptions
 * @property {boolean} reAddAbortedItems Whether or not aborted items should be readded to the queue
 * @property {boolean} rejectedFirst Whether or not rejected or aborted items should be readded in the beggining of the queue
 * @property {number} retries The number of times a rejected item should be retried. Aborted items do not count as rejected
 * for the number of retries.
 * @property {number} timeBetweenRetries The time in milliseconds to wait between retries for failed items
 * @property {boolean} endWhenSettled Whether or not the scheduler should wait for new items when currently set items are settled.
 * @property {boolean} monitor Whether or not to run the monitoring function. This function takes control of the running terminal to show the queue status.
 */

//! Needs to add different resolvers 
class Queue {
  #queue = [];
  #isReadding = false;
  #keepAliveInterval = null;
  #monitorInterval = null;

  /**
   * @param {QueueOptions} options
   */
  constructor(options = {}) {
    const {
      reAddAbortedItems,
      rejectedFirst,
      retries,
      timeBetweenRetries,
      endWhenSettled,
      monitor,
    } = options;

    this.paused = true;
    this.eventListener = new Subscriber(singletonAnnouncer, 'queueSubscriber');
    this.processorsPool = new ProcessorsPool(this.eventListener);
    this.settledItens = {};
    this.resolvedItens = {};
    this.rejectedItens = {};
    this.reAddAbortedItems = reAddAbortedItems ?? false;
    this.rejectedFirst = rejectedFirst ?? false;
    this.retries = retries ?? 0;
    this.timeBetweenRetries = timeBetweenRetries ?? 0;
    this.endWhenSettled = endWhenSettled ?? true;
    this.monitor = monitor;

    this.createQueueEvents();
    !endWhenSettled && this.keepAlive();
    monitor && this.setMonitor();
  }

  keepAlive() {
    this.#keepAliveInterval = setInterval(() => {}, 1 << 30);
  }
  
  createQueueEvents() {
    this.eventListener.on(ACTIONS.FINISH, this.onFinishedItem.bind(this));
    this.eventListener.on(ACTIONS.ABORT, this.onAbortedItem.bind(this));
  }

  /**
   * @typedef QueuedItem
   * @property {string} id
   * @property {Function} action
   * @property {number} retries
   * @property {string} [description]
   * @property {Error} [error]
   * @property {any} [data]
   */

  /**
   * 
   * @param {Function} asyncAction An asynchronous function to be added to the queue to run
   * @param {string} description Any string to be saved with the asynchronous function for future use by the user
   * @param {string} identifier An identifier to be used as key in the resolved asynchronous functions object
   * 
   * @returns {QueuedItem | null} The queued item. If value provided is not a function, returns null;
   */
  add(asyncAction, description, identifier, onReturn, shouldRetry) {
    try {
      if (!(asyncAction instanceof Function)) return null;
  
      let id = identifier;
  
      if (!id) {
        id = uniqueId();
      }
  
      const item = {
        id,
        action: asyncAction,
        shouldRetry,
        description,
        retries: 0,
      };
  
      this.#addToEnd(item);
      onReturn && this.eventListener.on(id, onReturn);

      return item;
    } catch (e) {
      announce.addedItem(e);
    }
  }

  #addToEnd(item) {
    this.#queue.push(item);
    announce.addedItem(null, item);
    this.#resumeAddedItens();
  }

  #addToBeggining(item) {
    this.#queue.unshift(item);
    announce.addedItem(null, item);
    this.#resumeAddedItens();
  }

  #resumeAddedItens() {
    const emptyProcessorsCount = this.processorsPool.emptyCount;
    if (!this.paused && emptyProcessorsCount !== 0) {
      this.resume(emptyProcessorsCount);
    }
  }

  /**
   * @param {string} itemId
   * @returns {number} The number of removed items from the queue
   * 
   * @description
   * Removes all items with provided itemId from the queue
   */
  remove(itemId) {
    try {
      const filteredQueue = this.#queue.filter((item) => item.id !== itemId);
      const removedItens = this.#queue.length - filteredQueue.length;
      this.#queue = filteredQueue;
      announce.removedItem(null, { id: itemId, removedItens });
      
      return removedItens;

    } catch (e) {
      announce.removedItem(e);
    }
  }

  /**
   * @returns {number} The number of removed items from the queue
   * 
   * @description
   * Removes all items from the queue
   */
  clear() {
    const removedItens = this.#queue.length;
    this.#queue = [];
    
    announce.removedItem(null, { removedItens });

    return removedItens;
  }

  abortRunningItems() {
    this.processorsPool.runningProcessors.forEach((processor) => {
      processor.abort()
    });
  }
  
  pause(abort = true) {
    if (this.paused) return;
    
    this.paused = true;

    if (abort) {
      this.abortRunningItems();
    }
  }
  
  stop() {
    this.pause(true);
    const removedItems = this.clear();
    !this.endWhenSettled && clearInterval(this.#keepAliveInterval);
    this.monitor && clearInterval(this.#monitorInterval);

    return removedItems;
  }

  destroy() {
    this.stop();
    clearInterval(this.#keepAliveInterval);
    clearInterval(this.#monitorInterval);
  }

  resume(resumeCount) {
    this.paused = false;

    const processorsToResume = resumeCount ?? this.processorsPool.size;
    for (let i = 0; i < processorsToResume; i += 1) {
      this.#next();
    }
  }

  /**
   * @param {number} maxParallelProcessors Number of items that can be running at the same time in a single moment
   * @description
   * Starts running the items
   */
  async run(maxParallelProcessors) {
    if (maxParallelProcessors || this.processorsPool.size === 0) {
      this.processorsPool.provisionProcessors(maxParallelProcessors);
    }

    this.resume();

    return new Promise((resolve) => {
      this.eventListener.on(ACTIONS.END, () => {
        resolve({
          settledItens: this.settledItens,
          resolvedItens: this.resolvedItens,
          rejectedItens: this.rejectedItens,
        });
      }
      );
    });
  }

  /**
   * @description Sets the next empty processor to run the next item in the queue, if there is any.
   */
  async #next() {
    if (this.paused) return;

    if (this.#queue.length === 0) return;

    const item = this.#queue.shift();
    const processor = await this.processorsPool.getNextEmptyProcessor();

    processor.run(item);
  }

  #finish() {
    const { runningCount, abortingCount } = this.processorsPool;
    const hasRunningItem = (runningCount + abortingCount) > 0;

    if (hasRunningItem) return;
    if (this.#queue.length > 0) return;
    if (this.#isReadding) return;
    if (!this.endWhenSettled) return;

    this.destroy();
    announce.end();
  }

  onFinishedItem(error, result) {
    const { item, data } = result;

    if (!item) return;

    if (error) {
      item.error = error;
      
      const shouldRetry = item.shouldRetry ? item.shouldRetry(error) : true;
      
      if (shouldRetry) {
        const itemReadded = this.readdRejectedItem(item);
  
        if (itemReadded) {
          this.#next();
          return;
        }
      }

      this.rejectedItens[item.id] = item;
    }

    if (data) {
      item.data = data;
      delete item.error;
      this.resolvedItens[item.id] = item;
    }

    this.settledItens[item.id] = item;
    announce.settledItem(error, item, data);
    this.eventListener.off(item.id);
    this.#next();
    this.#finish();
  }

  queueRejectedItem(item) {
    if (!item) return;

    this.#isReadding = true;
    
    setTimeout(() => {
      if (this.rejectedFirst) {
       this.#addToBeggining(item);
      } else {
        this.#addToEnd(item);
      }

      this.#isReadding = false;
    }, this.timeBetweenRetries);
  }

  onAbortedItem(error, { item }) {
    if (!this.reAddAbortedItems) return;
    
    //! Need to handle errors
    if (error) return;
    if (!item) return;
    
    this.queueRejectedItem(item);
  }

  /**
   * @param {*} item 
   * @returns {Boolean} Whether or not the rejected item was readded to the queue
   */
  readdRejectedItem(item) {
    if (!item) return false;
    if (item.retries >= this.retries) return false;
    
    item.retries += 1;
    this.queueRejectedItem(item);
    return true;
  }

  setMonitor() {
    this.#monitorInterval = setInterval(() => {
      // eslint-disable-next-line no-undef
      const out = process.stdout;
      const {
        runningProcessors,
        emptyProcessors,
        runningCount,
        emptyCount,
      } = this.processorsPool;

      console.clear();

      out.write('------------ Processor Pool -------------\n');
      out.write(`Paused: ${this.paused}\n`);
      out.write(`Queue: ${this.#queue.map((item) => item.description)}\n\n`);
      
      const resolved = Object.values(this.resolvedItens)
        .map(({ error, data }) => error ?? data)
        .sort((a, b) => a - b);

      const rejected = Object.values(this.rejectedItens)
        .map(({ error, data }) => error ?? data)
        .sort((a, b) => a - b);

      out.write(`Settled items:\n`);
      out.write(`Resolved: ${resolved}\n`);
      out.write(`Rejected: ${rejected}\n`);

      if (runningCount > 0) {
        out.write('\nRunning processors:\n');
        runningProcessors.forEach((processor) => {
          out.write(`${processor.id}: ${processor.currentItem.id}\n`);
        });
      }

      if (emptyCount > 0) {
        out.write('\nEmpty processors:\n');
        emptyProcessors.forEach((processor) => {
          out.write(`${processor.id}\n`);
        });
      }

      out.write('\nFailed itens:\n');
      const failedItems = [...this.#queue, ...runningProcessors.map((processor) => processor.currentItem)]
        .filter((item) => item.error)
        .map(({ description, retries }) => ({ description, retries }));

        failedItems.forEach((item) => {
          out.write(`${item.description} | retries: ${item.retries}\n`);
        });
      out.write('-----------------------------------------');
    }, 100);
  }

  get queue() {
    // queue object have function references in it and, therefore,
    // can't be copied using structuredClone native function
    return JSON.parse(JSON.stringify(this.#queue));
  }
}

module.exports = Queue;