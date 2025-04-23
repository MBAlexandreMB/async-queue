const Queue = require('./src/queue/Queue');
const { STRATEGIES } = require('./src/strategies/strategyFactory');

const asyncQueue = new Queue({ retries: 2, timeBetweenRetries: 500, strategy: STRATEGIES.EVENT });

for (let i = 0; i < 10; i += 1) {
  asyncQueue.add(() => {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (i % 2 !== 0) {
          reject(i);
          return;
        }
        
        resolve(i);
      }, 2000);
    });
  });
}

const MAX_PARALLEL_PROCESSORS = 2;
asyncQueue.run(MAX_PARALLEL_PROCESSORS)
  .then((eventListener) => {
    console.log({eventListener});

    eventListener.on(eventListener.actions.FINISH, (error, data) => {
      console.log({error, data});
    });
  });

