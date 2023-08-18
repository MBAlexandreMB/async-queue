const Queue = require('./Queue');

const NUMBER_OF_PROMISES = 15;
const PROMISE_MAX_RUNTIME = 3;
const FAIL_EVERY = 5;
const RETRIES = 3;
const results = [];

const createAsyncFunction = (result, timeout) => {
  return () => new Promise((resolve, reject) => {
    // const data = `${result} | ${timeout}ms`;
    const data = result;

    setTimeout(() => {
      if (result % FAIL_EVERY === 0) {
        reject(data);

        setTimeout(() => {
          asyncQueue.pause(true);
        }, 0);

        setTimeout(() => {
          asyncQueue.resume();
        }, 3000);
        return;
      }

      resolve(data);
    }, timeout);
  })
};

const handleResult = (error, data) => {
  if (error) {
    // console.log('Error:', error);
  }

  if (data) {
    // console.log('Result:', data);
  }
};


const asyncQueue = new Queue({
  monitor: true,
  reAddAbortedItems: true,
  // rejectedFirst: true,
  retries: RETRIES
});

// console.log('----------- Initializing test --------------')


// console.log('------ Setting events ------');
// asyncQueue.eventListener.on(ACTIONS.ADD, (error, promise) => {
//   console.log(promise);
// });

// console.log('------ Adding Promises ------');
for (let i = 1; i <= NUMBER_OF_PROMISES; i += 1) {

  const timeout = Math.random() * 5 * 1000;
  asyncQueue.add(createAsyncFunction(i, timeout), i, `async-${i}`, (error, data) => handleResult(error, data));
}

// console.log('-------------- RUNNING --------------');
asyncQueue.run(PROMISE_MAX_RUNTIME)
  .then(() => {
    // console.log('------------- END -------------');
  })
  .catch((e) => console.log(e));