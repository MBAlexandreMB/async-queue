const axios = require('axios');
const Queue = require('./Queue');

const NUMBER_OF_PROMISES = 15;
const PROMISE_MAX_RUNTIME = 3;
const FAIL_EVERY = 5;
const RETRIES = 3;
const results = [];

// const createAsyncFunction = (result, timeout) => {
//   return () => new Promise((resolve, reject) => {
//     // const data = `${result} | ${timeout}ms`;
//     const data = result;

//     setTimeout(() => {
//       if (result % FAIL_EVERY === 0) {
//         reject(data);

//         setTimeout(() => {
//           asyncQueue.pause(true);
//         }, 0);

//         setTimeout(() => {
//           asyncQueue.resume();
//         }, 3000);
//         return;
//       }

//       resolve(data);
//     }, timeout);
//   })
// };

const addExternalPromise = (asyncQueue, i) => {
  const timeout = Math.random() * 5 * 1000;
  // asyncQueue.add(createAsyncFunction(i, timeout), i, `async-${i}`, (error, data) => handleResult(error, data));
  asyncQueue.add(async ({ signal }) => {
    let url = `http://localhost:3000/?timeInMs=${timeout}`;
    // let url = `http://localhost:3000/?timeInMs=500`;

    const response = await axios.post(url, { number: i }, { signal });

    return response.data.number;
  }, i, i);
};

const handleResult = (error, data) => {
  if (error) {
    console.log('Error:', error);
  }

  if (data) {
    console.log('Result:', data);
  }
};


const asyncQueue = new Queue({
  monitor: true,
  reAddAbortedItems: true,
  // rejectedFirst: true,
  retries: RETRIES,
  waitTimeInMs: 5000,
});

for (let i = 1; i <= NUMBER_OF_PROMISES; i += 1) {
  addExternalPromise(asyncQueue, i);
}

// // Adds requests over time
// let counter = NUMBER_OF_PROMISES + 1;
// setInterval(() => {
//   addExternalPromise(asyncQueue, counter);
//   counter++;
// }, 2000);

asyncQueue.run(PROMISE_MAX_RUNTIME);
