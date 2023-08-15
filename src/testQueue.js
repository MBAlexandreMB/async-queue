const Queue = require('./Queue');

const NUMBER_OF_PROMISES = 100;
const PROMISE_MAX_RUNTIME = 5;
const FAIL_EVERY = 5;
const results = [];

const createAsyncFunction = (result, timeout) => {
  return () => new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve(result);
    }, timeout);
  })
};


const asyncQueue = new Queue();

console.log('----------- Initializing test --------------')


console.log('------ Setting events ------');
// asyncQueue.eventListener.on(ACTIONS.ADD, (error, promise) => {
//   console.log(promise);
// });

console.log('------ Adding Promises ------');
for (let i = 1; i <= NUMBER_OF_PROMISES; i += 1) {
  asyncQueue.add(createAsyncFunction(i, 1000), i, `async-${i}`, (error, data) => console.log('Result:', data));
}

console.log(asyncQueue.queue);
console.log('-------------- RUNNING --------------');
asyncQueue.run(PROMISE_MAX_RUNTIME)
  .then(() => {
    console.log('------------- END -------------');
  })
  .catch((e) => console.log(e));