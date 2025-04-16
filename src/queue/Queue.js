const { announce, ACTIONS } = require("./queue.events");
const { singletonAnnouncer, Subscriber } = require("../pub-sub");
const ProcessorsPool = require("../processors/ProcessorsPool");
const uniqueId = require("../helpers/uniqueId");

/**
 * @typedef {Object} QueueOptions
 * @property {boolean} reAddAbortedItems Whether or not aborted items should be readded to the queue
 * @property {boolean} rejectedFirst Whether or not rejected or aborted items should be readded in the beggining of the queue
 * @property {number} retries The number of times a rejected item should be retried. Aborted items do not count as rejected
 * for the number of retries.
 * @property {number} timeBetweenRetries The time in milliseconds to wait between retries for failed items
 * @property {boolean} endWhenSettled Whether or not the scheduler should wait for new items when currently set items are settled.
 */

class Queue {
  #queue = [];
  #isReadding = false;
  #keepAliveInterval = null;

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
    } = options;

    this.paused = true;
    this.eventListener = new Subscriber(singletonAnnouncer, 'queueSubscriber');
    this.processorsPool = new ProcessorsPool(this.eventListener);
    this.settledItems = {};
    this.resolvedItems = {};
    this.rejectedItems = {};
    this.abortedItems = {};
    this.reAddAbortedItems = reAddAbortedItems ?? false;
    this.rejectedFirst = rejectedFirst ?? false;
    this.retries = retries ?? 0;
    this.timeBetweenRetries = timeBetweenRetries ?? 0;
    this.endWhenSettled = endWhenSettled ?? true;

    this.#createQueueEvents();
    !endWhenSettled && this.#keepAlive();
  }

  #keepAlive() {
    this.#keepAliveInterval = setInterval(() => {}, 1 << 30);
  }
  
  #createQueueEvents() {
    this.eventListener.on(ACTIONS.FINISH, this.#onFinishedItem.bind(this));
    this.eventListener.on(ACTIONS.ABORT, this.#onAbortedItem.bind(this));
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
    this.#resumeAddedItems();
  }

  #addToBeggining(item) {
    this.#queue.unshift(item);
    announce.addedItem(null, item);
    this.#resumeAddedItems();
  }

  #resumeAddedItems() {
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
      const removedItems = this.#queue.length - filteredQueue.length;
      this.#queue = filteredQueue;
      announce.removedItem(null, { id: itemId, removedItems });
      
      return removedItems;

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
    const removedItems = this.#queue.length;
    this.#queue = [];
    
    announce.removedItem(null, { removedItems });

    return removedItems;
  }

  #abortRunningItems(reason) {
    this.processorsPool.runningProcessors.forEach((processor) => {
      processor.abort(reason);
    });
  }
  
  pause(abort = true, reason = "Queue paused per request") {
    if (this.paused) return;
    
    this.paused = true;

    if (abort) {
      this.#abortRunningItems(reason);
    }
  }
  
  stop() {
    this.pause(true, "Queue stopped per request");
    const removedItems = this.clear();
    !this.endWhenSettled && clearInterval(this.#keepAliveInterval);

    return removedItems;
  }

  destroy() {
    this.stop();
    clearInterval(this.#keepAliveInterval);
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
          settledItems: this.settledItems,
          resolvedItems: this.resolvedItems,
          rejectedItems: this.rejectedItems,
          abortedItems: this.abortedItems,
        });
      });
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

  #handleSettledItem(item, error, data) {
    this.settledItems[item.id] = item;
    announce.settledItem(error, item, data);
    this.eventListener.off(item.id);
    this.#next();
    this.#finish();
  }

  #onFinishedItem(error, result) {
    const { item, data } = result;

    if (!item) return;

    if (error) {
      item.error = error;
      
      const shouldRetry = item.shouldRetry ? item.shouldRetry(error) : true;
      
      if (shouldRetry) {
        const itemReadded = this.#readdRejectedItem(item);
  
        if (itemReadded) {
          this.#next();
          return;
        }
      }

      this.rejectedItems[item.id] = item;
      this.#handleSettledItem(item, error, data);
      return;
    }

    item.data = data;
    delete item.error;
    this.resolvedItems[item.id] = item;
    this.#handleSettledItem(item, error, data);
  }

  #queueRejectedItem(item) {
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

  #onAbortedItem(error, { item }) {
    if (!item) return;

    if (error) {
      item.error = error;
    }

    if (!this.reAddAbortedItems) {
      this.abortedItems[item.id] = item;
      return;
    }
    
    this.#queueRejectedItem(item);
  }

  /**
   * @param {*} item 
   * @returns {Boolean} Whether or not the rejected item was readded to the queue
   */
  #readdRejectedItem(item) {
    if (!item) return false;
    if (item.retries >= this.retries) return false;
    
    item.retries += 1;
    this.#queueRejectedItem(item);
    return true;
  }

  get queue() {
    // queue object have function references in it and, therefore,
    // can't be copied using structuredClone native function
    return JSON.parse(JSON.stringify(this.#queue));
  }
}

module.exports = Queue;