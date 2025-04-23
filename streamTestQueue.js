const Queue = require('./src/queue/Queue');

const asyncQueue = new Queue({
  retries: 2,
  timeBetweenRetries: 500,
  streamResult: true,
  strategy: 'stream',
});

console.log({ asyncQueue });

for (let i = 0; i < 10; i += 1) {
  asyncQueue.add(() => {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        // Rejects odd numbers
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
  .then(readable => {
    readable.on('data', (chunk) => {
      if (chunk.error) {
        console.error(chunk);
        return;
      }

      console.log(chunk);
    });

    readable.on('error', (error) => {
      console.error({ error });
    });

    readable.on('end', () => {
      console.log('All items processed');
    });
  });

// setTimeout(() => {
//   asyncQueue.pause(true);

//   setTimeout(() => {
//     asyncQueue.resume();
//   }, (5000));
// }, 4000);

