const { singletonAnnouncer } = require("./Announcer");
const ProcessorsPool = require("./ProcessorsPool");
const { announce, ACTIONS } = require("./queue.events");
const Subscriber = require("./Subscriber");
const uniqueId = require("./uniqueId");

class Queue {
  #queue = [];

  constructor() {
    this.paused = true;
    this.eventListener = new Subscriber(singletonAnnouncer, 'queueSubscriber');
    this.processorsPool = new ProcessorsPool(this.eventListener);
    this.settledItens = {};
    this.resolvedItens = {};
    this.rejectedItens = {};
    this.createQueueEvents();
  }

  
  createQueueEvents() {
    this.eventListener.on(ACTIONS.FINISH, this.onFinishedItem.bind(this));
    // this.eventListener.on(ACTIONS.ADD, this.onAddedItem);
    // this.eventListener.on(ACTIONS.ABORT, this.onAbortedItem);
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
  add(asyncAction, description, identifier, onReturn) {
    try {
      if (!(asyncAction instanceof Function)) return null;
  
      let id = identifier;
  
      if (!id) {
        id = uniqueId();
      }
  
      const item = {
        id,
        action: asyncAction,
        description,
        retries: 0,
      };
  
      this.#queue.push(item);
      announce.addedItem(null, item);

      onReturn && this.eventListener.on(id, onReturn);
      console.log(this.eventListener);

      return item;
    } catch (e) {
      announce.addedItem(e);
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
  
  pause() {
    if (!this.paused) {
      this.paused = true;
    }
  }
  
  stop() {
    this.pause();
    const removedItems = this.clear();

    return removedItems;
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
    
    if (error) {
      item.error = error;
      this.rejectedItens[item.id] = item;
    }

    if (data) {
      item.data = data;
      this.resolvedItens[item.id] = item;
    }

    this.settledItens[item.id] = item;
    this.eventListener.off(item.id);
    this.#next();
  }

  get queue() {
    // queue object have function references in it and, therefore,
    // can't be copied using structuredClone native function
    return JSON.parse(JSON.stringify(this.#queue));
  }
}

module.exports = Queue;