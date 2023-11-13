# Async Queue
#### A package to handle high number of asynchronous functions when time is a problem and to fail is not an option.

Sometimes we have specific time sensitive problems that are hard to handle asynchronously, as code refuses to wait. Imagine this situation: you need to get a lot of information from an API, but this API have a rate limiter. This API does not allows you to take all the information in one single request, so you need to send hundreds of requests to get everything that you need. But it's limiter is not allowing you to do more than a handful of requests before returning 429 (HTTP "Too Many Requests" error code).

This rate limiter is time sensitive. 20 requests every 10 seconds. How to handle that?
Waiting 10 seconds using a settimeout wouldn't be a good practice. And what about the failed requests?

What about the third party library is simply not reliable? How would you retry failing / inconsistent requests?

That's what Async Queue is here to solve!

### Setup

```npm i asyncqueue```


### How to use it

Instantiate a new Queue

```const asyncQueue = new Queue()```

Add asynchronous functions to it.
```
    asyncQueue.add(() => Promise.resolve("Hello World"));
```

Run the queue, setting how many asynchronous functions should run in parallel and wait for the result.

Using async/await:
```
    const FUNCTIONS_IN_PARALLEL = 100;
    const result = await asyncQueue.run(FUNCTIONS_IN_PARALLEL);
```

Using promises:
```
    const FUNCTIONS_IN_PARALLEL = 100;
    asyncQueue.run(FUNCTIONS_IN_PARALLEL)
        .then((result) => {
            //...
        });
```

### Using events
Instead of waiting for the entire batch of results, you can listen for the result of every function you add.

```
asyncQueue.add(
    () => Promise.resolve("Hello World"),
    'description',
    'uniqueIdentifier'
    (error, data) => {
        // Handle the return for this specific function
    }
);
```

#### Queue Options
Using the asyncqueue package allows you to leverage from different utilitary options.
You can set those options when instantiating a new Queue:

```
    const asyncQueue = new Queue({
        // ...options
    });
```

| Option             | type    | description                                                                                                                                                                                | Default value |
|--------------------|---------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|---------------|
| reAddAbortedItems  | boolean | Whether or not manually aborted items should be readded to the queue.                                                                                                                      | false         |
| rejectedFirst      | boolean | Whether or not rejected or aborted items should be readded in the beggining of the queue.                                                                                                  | false         |
| retries            | number  | The number of times a rejected item should be retried. Aborted items do not count as rejected for the number of retries.                                                                   | 0             |
| timeBetweenRetries | number  | The time in milliseconds to wait between retries for failed items.                                                                                                                         | 0             |
| endWhenSettled     | boolean | Whether or not the scheduler should wait for new items when currently set items are settled. When this option is set to false, the Queue will need to be stopped using the destroy method. | true          |


#### Queue Methods
The asyncqueue package allows you to control the flow of your asynchronous functions.

| Method  | Parameters                                                                                                                                                                                                                                                                                                                                                 | Returns                                                                                                                                           | Description                                                                                                                                                                                                                                         |
|---------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| add     | asyncAction (required) description - description saved in the item object for user reference identifier - identifier to replace automatically set ids onReturn - callback function called when asyncAction is settled shouldRetry - function that receives an error as parameter and should return whether or not a rejected asyncAction should be retried | The queued item in this format: ```{   id: string,   action: Function,   retries: number,   description: string,   error: Error,   data: any }``` | Adds an asynchronous function to the queue. New items are added to the end of the queue.                                                                                                                                                            |
| remove  | Item identifier (id)                                                                                                                                                                                                                                                                                                                                       | The count of removed items from the queue                                                                                                         | Removes all items with provided itemId from the queue.                                                                                                                                                                                              |
| clear   | N/A                                                                                                                                                                                                                                                                                                                                                        | The count of removed items from the queue                                                                                                         | Removes all items from the queue. Running items are still going to settle.                                                                                                                                                                          |
| pause   | abort - Whether or not running items should be aborted. The result of aborted asyncActions are ignored.                                                                                                                                                                                                                                                    | void                                                                                                                                              | Pauses the execution of new asyncActions. If aborted, also ignores the result of running items (i.e. they will not settle). If ```reAddAbortedItems``` option is set to `true`, aborted items are readded to be executed when the queue is resumed. |
| stop    | N/A                                                                                                                                                                                                                                                                                                                                                        | The count of removed items from the queue                                                                                                         | Pauses and aborts the queue execution, clears the queue and kills the keep alive loop if ```endWhenSettled``` is set to false.                                                                                                                      |
| destroy | N/A                                                                                                                                                                                                                                                                                                                                                        | void                                                                                                                                              | Stops, but make sure that the keep alive loop is destroyed.                                                                                                                                                                                         |
| resume  | resumeCount - The number of parallel asyncActions that should be resumed. The maximum number of parallel asyncActions are still set by the "maxParallelProcessors" parameter in the "run" method.                                                                                                                                                          | void                                                                                                                                              | Unpauses / resumes the queue execution.                                                                                                                                                                                                             |
| run     | maxParallelProcessors - The number of maximum parallel asyncActions to run at a time.                                                                                                                                                                                                                                                                      | A promise of settled, resolved and rejected async actions. Each object is organized by the queued item id.                                        | Starts the queue execution and returns a promise that resolves when all asyncActions are settled and the keep alive loop is destroyed.                                                                                                              |

#### Aborted vs rejected items
Aborted items are asynchronous functions that had their execution stopped by the user. An aborted item never settles.
The asyncqueue package will send an abort signal, which can be used by the provided callback function.
If the callback function does not aborts its execution, asynchronous functions will continue to run after aborted, but it's result will be ignored.
Aborted functions that are not readded to the queue will not appear in the settledItems object in the result.

Rejected items are asynchronous functions (promises) that were rejected within it's execution. Rejected functions will save their last error message (if different within retries).
Rejected items that should retry (using the ```retries``` option from Queue's constructor and the `shouldRetry` callback function from the `add` method), will keep trying after a delimited number of milliseconds (using the `timeBetweenRetries` option from Queue's constructor).
If a rejected item shouldn't retry or all retries failed, the item will be saved in the settled and the rejected objects.


###### Future development
- Add support to streams
- Add better error handling when aborting items

Any PR is welcomed!
