const { announce } = require("./queue.events");
const uniqueId = require("./uniqueId");

class Processor {
  #abortController;
  #currentItem;

  constructor() {
    this.#abortController = null;
    this.#currentItem = null;
    this.id = uniqueId();
  }

  resolve(data) {
    if (this.#currentItem) {
      announce.finishedRunningItem(null, this.#currentItem, data);
    }
  }

  reject(error) {
    if (this.#currentItem) {
      announce.finishedRunningItem(error, this.#currentItem);
    }
  }

  release() {
    announce.availableProcessor(this);
  }

  abort(error) {
    this.#abortController?.abort();
    announce.abortedRunningItem(error, this.#currentItem);
  }

  async run(item) {
    if (!item?.action) return;
    
    this.#abortController = new AbortController();
    
    try {
      this.#currentItem = item;
      announce.startedRunningItem(this, this.#currentItem);
      const result = await item.action({ signal: this.#abortController?.signal });
      
      this.resolve(result);
    } catch (e) {
      this.reject(e);
    } finally {
      if (this.#currentItem) {
        this.clear();
      }
    }
  }

  clear() {
    this.#abortController = null;
    this.#currentItem = null;
    this.release();
  }

  stop() {
    this.abort();
    this.clear();
  }
}

module.exports = Processor;