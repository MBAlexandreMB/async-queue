const uniqueId = require("./uniqueId");

class Processor {
  /**
   * @param {Function} onFinish A function to be called when the processor has finished running
   */
  constructor(onFinish) {
    this.onFinish = onFinish;
    this.id = uniqueId();
  }

  finish() {
    this.onFinish?.(this);
  }

  async run(asyncFunc) {
    if (!asyncFunc) return;
    
    try {
      const result = await asyncFunc();
      
      return result;
    } finally {
      this.finish();
    }
  }
}

module.exports = Processor;