const StreamStrategy = require('./stream.strategy');
// const PromiseStrategy = require('./promise.strategy');
// const EventStrategy = require('./event.strategy');

const STRATEGIES = {
  STREAM: 'stream',
  PROMISE: 'promise',
  EVENT: 'event',
};

const strategyFactory = (strategyName) => {
  switch (strategyName) {
    case STRATEGIES.STREAM:
      return new StreamStrategy();
      // case STRATEGIES.EVENT:
      //   return new EventStrategy();
    case STRATEGIES.PROMISE:
    default:
      // return new PromiseStrategy();
  }
};

module.exports = {
  STRATEGIES,
  strategyFactory,
};