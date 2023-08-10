const Announcer = require("./Announcer");
const uniqueId = require("./uniqueId");

class Subscriber {
  /**
   * @param {Announcer} announcer 
   * @param {string} id 
   */
  constructor(announcer, id) {
    this.announcer = announcer;
    this.id = id ?? uniqueId();
  }
  
  on(eventName, cb) {
    this.announcer.subscribe(eventName, cb, this.id);
  }

  off() {
    this.announcer.unsunscribe(eventName, this.id);
  }
}

module.exports = Subscriber;