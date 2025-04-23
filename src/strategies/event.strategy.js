const { singletonAnnouncer, Subscriber } = require("../pub-sub");
const { ACTIONS } = require("../queue/queue.events");

class EventStrategy {
  constructor() {
    this.eventListener = new Subscriber(singletonAnnouncer, 'eventStrategySubscriber');
  }

  return() {
    return {
      ...this.eventListener,
      on: this.eventListener.on,
      off: this.eventListener.off,
      actions: ACTIONS,
    };
  }
}

module.exports = EventStrategy;