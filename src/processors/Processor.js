const { announce } = require("../queue/queue.events");
const uniqueId = require("../helpers/uniqueId");

class Processor {
  #abortController;
  #abortedItens

  constructor() {
    this.#abortController = null;
    this.currentItem = null;
    this.#abortedItens = {};
    this.id = uniqueId();
  }

  isAbortedItem(itemId) {
    return Boolean(this.#abortedItens[itemId]);
  }

  handleAbortedResult(itemId) {
    if (this.isAbortedItem(itemId)) {
      delete this.#abortedItens?.[itemId];
      return true;
    }

    return false;
  }

  settle(error, item, data) {
    this.release();

    const isAbortedItem = this.handleAbortedResult(item.id);
    if (isAbortedItem) return;

    announce.finishedRunningItem(error, item, data);
  }

  release() {
    announce.availableProcessor(this);
  }

  abort(error) {
    if (!this. currentItem) return;
    if (this.#abortedItens?.[this.currentItem.id]) return;

    this.#abortController?.abort();
    this.#abortedItens[this.currentItem.id] = this.currentItem;
    announce.abortedRunningItem(error, this.currentItem);
  }

  async run(item) {
    if (!item) return;
    if (!item.action) return;

    this.#abortController = new AbortController();
    let data, error;
    
    try {
      this.currentItem = item;
      announce.startedRunningItem(this, this.currentItem);
      data = await item.action({ signal: this.#abortController?.signal });
    } catch (e) {
      error = e;
    } finally {
      this.settle(error, item, data);
      this.clear();
    }
  }

  clear() {
    this.#abortController = null;
    this.currentItem = null;
  }
}

module.exports = Processor;