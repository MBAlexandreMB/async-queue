const { Subscriber, singletonAnnouncer } = require("../pub-sub");
const { ACTIONS } = require("../queue/queue.events");


class PromiseStrategy {
  constructor() {
    this.eventListener = new Subscriber(singletonAnnouncer, 'promiseStrategySubscriber');
    this.settledItems = {};
    this.resolvedItems = {};
    this.rejectedItems = {};
    this.abortedItems = {};    
  }

  return() {
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

  #handleError(data, error) {
    if (error) {
      data.error = error;
    }

    return data;
  }

  onError(data, error) {
    this.rejectedItems[data.id] = this.#handleError(data, error);
  }

  onResolve(data) {
    this.resolvedItems[data.id] = data;
  }

  onSettle(data) {
    this.settledItems[data.id] = data;
  }

  abort(data, error) {
    this.abortedItems[data.id] = this.#handleError(data, error);
  }

  destroy() {
  }
}

module.exports = PromiseStrategy;