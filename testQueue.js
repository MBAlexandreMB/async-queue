const axios = require('axios');
const Queue = require('./src/Queue');

const NUMBER_OF_PROMISES = 5;
const PROMISE_MAX_RUNTIME = 2;
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

const shouldRetry = (error) => {
  return error.response.status === 429
};

const addExternalPromise = (asyncQueue, i) => {
  const timeout = Math.random() * 5 * 1000;
  // asyncQueue.add(createAsyncFunction(i, timeout), i, `async-${i}`, (error, data) => handleResult(error, data));
  asyncQueue.add(async ({ signal }) => {
    let url = `http://localhost:3000/?timeInMs=${timeout}`;
    // let url = `http://localhost:3000/?timeInMs=500`;

      const response = await axios.post(url, { number: i }, { signal });

      return response.data.number;
  }, i, i, handleResult, shouldRetry); 
};

const handleResult = (error, data) => {
  if (error) {
    console.log('Error:', error.response.data);
  }

  if (data) {
    console.log('Result:', data);
  }
};


const asyncQueue = new Queue({
  // monitor: true,
  reAddAbortedItems: true,
  // rejectedFirst: true,
  retries: RETRIES,
  waitTimeInMs: 500,
  endWhenSettled: false,
});

for (let i = 1; i <= NUMBER_OF_PROMISES; i += 1) {
  addExternalPromise(asyncQueue, i);
}

// Adds requests over time
let counter = NUMBER_OF_PROMISES + 1;
const interval = setInterval(() => {  
  addExternalPromise(asyncQueue, counter);
  counter++;
  
  if (counter >= 10) {
    clearInterval(interval);
  }

}, 2000);

asyncQueue.run(PROMISE_MAX_RUNTIME)
  .then(r => console.log(r))
  .catch(e => console.log(e));


// // -------------------Simpler version-------------------
// const asyncQueue = new Queue({
//   // monitor: true,
//   reAddAbortedItems: true,
//   // rejectedFirst: true,
//   retries: RETRIES,
//   waitTimeInMs: 500,
//   endWhenSettled: true,
// });

// for (let i = 1; i <= 10; i += 1) {
//   asyncQueue.eventListener.on(i, (data, error) => {
//     console.log({data, error});
//   })
//   asyncQueue.add(() => new Promise((resolve, reject) => {
//     setTimeout(() => {
//       if (Math.random() > 0.3) {
//         resolve(i);
//         return;
//       }
//       reject(i);
//     }, Math.random() * 5 * 1000);
//   }), i, i);
// }


// asyncQueue.run(PROMISE_MAX_RUNTIME)
//   .then(r => console.log(r))
//   .catch(e => console.log(e));