const uniqueId = require("../helpers/uniqueId");

class Subscriber {
  constructor(announcer, id) {
    /**
     * @type {Announcer}
     */
    this.announcer = announcer;
    /**
     * @type {String}
     */
    this.id = id ?? uniqueId();
  }
  
  on(eventName, cb) {
    this.announcer.subscribe(eventName, cb, this.id);
  }

  off(eventName) {
    this.announcer.unsubscribe(eventName, this.id);
  }
}

module.exports = Subscriber;