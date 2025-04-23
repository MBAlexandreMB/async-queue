const { Readable } = require("stream");

class StreamStrategy {
  #streamController = null;

  constructor() {}

  return() {
    this.#streamController = new Readable({
      objectMode: true,
      read() {},
    });

    return this.#streamController;
  }

  onError(data, error) {
    this.#streamController.push({...data, error });  
  }

  onResolve(data) {
    this.#streamController.push(data);
  }

  abort(data, error) {
    this.onError(data, error);
  }

  destroy() {
    this.#streamController?.push(null);
  }
}

module.exports = StreamStrategy;