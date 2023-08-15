const Processor = require("./Processor");
const { ACTIONS } = require("./queue.events");

class ProcessorsPool {
  #processorRequestQueue;

  constructor(listener) {
    this.listener = listener;
    /** @type {Processor[]} */
    this.runningProcessors = [];
    /** @type {Processor[]} */
    this.emptyProcessors = [];
    this.#processorRequestQueue = [];
    this.setEvents();
  }

  get emptyCount() { return this.emptyProcessors.length }
  get runningCount() { return this.runningProcessors.length }
  get size() { return this.emptyCount + this.runningCount }

  setEvents() {
    this.listener.on(ACTIONS.AVAILABLE_PROCESSOR, this.handleAvailableProcessor.bind(this));
  }

  handleAvailableProcessor(error, processor) {
    if (error) return;

    const index = this.runningProcessors.findIndex((runningProcessor) => runningProcessor.id === processor.id);

    if (index !== -1) {
      const processor = this.runningProcessors[index];
      this.runningProcessors.splice(index, 1);

      this.emptyProcessors.push(processor);
      this.warnEmptyProcessors();
    }
  }

  warnEmptyProcessors() {
    this.#processorRequestQueue.shift()?.();
  }

  /**
   * @param {Number} number The number of processors to be provisioned.
   * 
   * @description
   * This function will make the ProcessorsPool have the length equal the number provided.
   * The default length is 1.
   */
  provisionProcessors(number = 1) {
    const processorsToProvision = number - this.size;
    
    if (processorsToProvision < 0) {
      const processorsToRemove = Math.abs(processorsToProvision);
      this.removeProcessors(processorsToRemove);
    } else if (processorsToProvision > 0) {
      this.addProcessors(processorsToProvision);
    }
  }

  addProcessors(number) {
    for (let i = 1; i <= number; i += 1) {
      const processor = new Processor();
      this.emptyProcessors.push(processor);
    }
  }

  removeProcessors(number) {
    const emptyDiff = this.emptyCount - number;

    const emptyRemoveCount = emptyDiff < 0 ? this.emptyCount : emptyDiff;
    const runningRemoveCount = Math.max(number - this.emptyCount, 0);

    if (emptyRemoveCount > 0) {
      this.emptyProcessors.splice(0, emptyRemoveCount);
    }

    if (runningRemoveCount > 0) {
      this.runningProcessors.splice(0, runningRemoveCount);
    }
  }

  /** 
   * @description
   * Gets an empty processor if there is any. Returns null if none is available
   * 
   * @returns {Processor | null}
   */
  getEmptyProcessor() {
    if (this.emptyCount === 0) return null;

    const nextProcessor = this.emptyProcessors.shift();
    this.runningProcessors.push(nextProcessor);
    return nextProcessor;
  }

  /**
   * @description
   * Gets the next empty processor and awaits until one is available.
   * 
   * @returns {Processor}
   */
  async getNextEmptyProcessor() {
    return new Promise((resolve) => {
      const processor = this.getEmptyProcessor();

      if (processor) {
        resolve(processor);
        return;
      }

      this.#processorRequestQueue.push(() => {
        resolve(this.getEmptyProcessor());
      });
    });
  }
}

module.exports = ProcessorsPool;