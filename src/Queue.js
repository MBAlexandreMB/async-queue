const { singletonAnnouncer } = require("./Announcer");
const ProcessorsPool = require("./ProcessorsPool");
const { announce, ACTIONS } = require("./queue.events");
const Subscriber = require("./Subscriber");
const uniqueId = require("./uniqueId");

/**
 * @typedef {Object} QueueOptions
 * @property {Boolean} reAddAbortedItems Whether or not aborted items should be readded to the queue
 * @property {Boolean} rejectedFirst Whether or not rejected or aborted items should be readded in the beggining of the queue
 * @property {Number} retries The number of times a rejected item should be retried. Aborted items do not count as rejected
 * for the number of retries.
 * @property {Number} waitTimeInMs The time in milliseconds to wait between retries for failed promises
 * @property {Number} monitor Whether or not to run the monitoring function. This function takes control of the running terminal to show the queue status.
 */

class Queue {
  #queue = [];

  /**
   * @param {QueueOptions} options
   */
  constructor(options = {}) {
    this.paused = true;
    this.eventListener = new Subscriber(singletonAnnouncer, 'queueSubscriber');
    this.processorsPool = new ProcessorsPool(this.eventListener);
    this.settledItens = {};
    this.resolvedItens = {};
    this.rejectedItens = {};
    this.reAddAbortedItems = options?.reAddAbortedItems ?? false;
    this.rejectedFirst = options?.rejectedFirst ?? false;
    this.retries = options?.retries ?? 0;
    this.waitTimeInMs = options.waitTimeInMs ?? 0;
    
    this.createQueueEvents();
    options?.monitor && this.monitor();
  }

  
  createQueueEvents() {
    this.eventListener.on(ACTIONS.FINISH, this.onFinishedItem.bind(this));
    this.eventListener.on(ACTIONS.ABORT, this.onAbortedItem.bind(this));
    // this.eventListener.on(ACTIONS.ADD, this.onAddedItem);
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
   * @param {Function} asyncAction A function that returns the promise to be added to the queue to run
   * @param {string} description Any string to be saved with the promise for future use by the user
   * @param {string} identifier An identifier to be used as key in the resolved promises object
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
   * @param {string} promiseId
   * @returns {number} The number of removed promises from the queue
   * 
   * @description
   * Removes all promises with provided promiseId from the queue
   */
  remove(promiseId) {
    try {
      const filteredQueue = this.#queue.filter((item) => item.id !== promiseId);
      const removedItens = this.#queue.length - filteredQueue.length;
      this.#queue = filteredQueue;
      announce.removedItem(null, { id: promiseId, removedItens });
      
      return removedItens;

    } catch (e) {
      announce.removedItem(e);
    }
  }

  /**
   * @returns {number} The number of removed promises from the queue
   * 
   * @description
   * Removes all promises from the queue
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

    return removedItems;
  }

  resume(resumeCount) {
    this.paused = false;

    const processorsToResume = resumeCount ?? this.processorsPool.size;
    for (let i = 0; i < processorsToResume; i += 1) {
      this.#next();
    }
  }

  /**
   * @param {number} maxParallelPromises Number of promises to be called at the same time
   * @description
   * Starts running the promises
   */
  async run(maxParallelPromises) {
    if (maxParallelPromises || this.processorsPool.size === 0) {
      this.processorsPool.provisionProcessors(maxParallelPromises);
    }

    this.resume();

    return new Promise((resolve) => {
      this.eventListener.on(ACTIONS.END, () => resolve({
        settledItens: this.settledItens,
        resolvedItens: this.resolvedItens,
        rejectedItens: this.rejectedItens,
      }));
    });
  }

  async #next() {
    if (this.paused) return;

    if (this.#queue.length === 0) {
      announce.end();
      return;
    }

    const promise = this.#queue.shift();
    const processor = await this.processorsPool.getNextEmptyProcessor();

    processor.run(promise);
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
  }

  queueRejectedItem(item) {
    if (!item) return;
    
    setTimeout(() => {
      if (this.rejectedFirst) {
       this.#addToBeggining(item);
      } else {
        this.#addToEnd(item);
      }
    }, this.waitTimeInMs);
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

  monitor() {
    setInterval(() => {
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

      out.write(`Settled promises:\n`);
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