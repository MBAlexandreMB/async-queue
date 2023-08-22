const { announce } = require("./queue.events");
const uniqueId = require("./uniqueId");

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

  resolve(data, itemId) {
    const isAbortedItem = this.handleAbortedResult(itemId);
    if (isAbortedItem) return;

    announce.finishedRunningItem(null, this.currentItem, data);
  }

  reject(error, itemId) {
    const isAbortedItem = this.handleAbortedResult(itemId);
    if (isAbortedItem) return;

    announce.finishedRunningItem(error, this.currentItem);
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
    const { id: itemId } = item;

    this.#abortController = new AbortController();
    
    try {
      this.currentItem = item;
      announce.startedRunningItem(this, this.currentItem);
      const result = await item.action({ signal: this.#abortController?.signal });
      
      this.resolve(result, itemId);
    } catch (e) {
      this.reject(e, itemId);
    } finally {
      this.clear();
    }
  }

  clear() {
    this.#abortController = null;
    this.currentItem = null;
    this.release();
  }
}

module.exports = Processor;