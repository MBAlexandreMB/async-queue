const { PromiseQueue } = require("./promiseQueue");

describe('promiseQueue', () => {
  describe('add', () => {
    it('should not add a promise without a wrapper function', () => {
      const promiseQueuer = new PromiseQueue();

      promiseQueuer.add(Promise.resolve(1));
      
      expect(promiseQueuer.promiseQueue.length).toBe(0);
    });

    it('should add a callback that returns a promise', () => {
      const promiseQueuer = new PromiseQueue();

      promiseQueuer.add(() => Promise.resolve(1));
      
      expect(promiseQueuer.promiseQueue.length).toBe(1);
    });

    it('should add a description to the promise, when supplied', () => {
      const promiseQueuer = new PromiseQueue();
      const description = 'This is a description';

      promiseQueuer.add(() => Promise.resolve(1), description);
      const addedPromise = promiseQueuer.promiseQueue[0];

      expect(addedPromise.description).toBe(description);
    });

    it('should use the provided identifier, when supplied', () => {
      const promiseQueuer = new PromiseQueue();
      const providedId = '123Test123';

      promiseQueuer.add(() => Promise.resolve(1), null, providedId);
      const addedPromise = promiseQueuer.promiseQueue[0];

      expect(addedPromise.id).toBe(providedId);
    });
  });

  describe('remove', () => {
    it('should return 1, when succeded for 1 promise in the queue', () => {
      const promiseQueuer = new PromiseQueue();
      const { id } = promiseQueuer.add(() => Promise.resolve(1));
      
      const removedPromises = promiseQueuer.remove(id);
      expect(removedPromises).toBe(1);
    });

    it('should return the number of removed promises, when succeded', () => {
      const promiseQueuer = new PromiseQueue();
      const equalId = 'id123';

      promiseQueuer.add(() => Promise.resolve(1), null, equalId);
      promiseQueuer.add(() => Promise.resolve(1), null, equalId);
      
      const removedPromises = promiseQueuer.remove(equalId);
      expect(removedPromises).toBe(2);
    });

    it('should remove the promise with the provided identifier from the queue', () => {
      const promiseQueuer = new PromiseQueue();
      const { id } = promiseQueuer.add(() => Promise.resolve(1));
      const addedPromise = promiseQueuer.promiseQueue.find((item) => item.id === id);
      
      expect(addedPromise).not.toBeUndefined();
      
      promiseQueuer.remove(id);
      expect(promiseQueuer.promiseQueue.length).toBe(0);

      const removedPromise = promiseQueuer.promiseQueue.find((item) => item.id === id);
      expect(removedPromise).toBeUndefined();
    });

    it('should not remove any promise if the provided id is not in the queue', () => {
      const promiseQueuer = new PromiseQueue();
      promiseQueuer.add(() => Promise.resolve(1));
  
      expect(promiseQueuer.promiseQueue.length).toBe(1);
      
      promiseQueuer.remove('otherId');
      expect(promiseQueuer.promiseQueue.length).toBe(1);
    });
  
    it('should return 0 when the provided id is not in the queue', () => {
      const promiseQueuer = new PromiseQueue();
      promiseQueuer.add(() => Promise.resolve(1));
      
      const removedPromises = promiseQueuer.remove('otherId');
      expect(removedPromises).toBe(0);
    });
  
  });

  describe('clear', () => {
    it('should remove all promises from the queue', () => {
      const promiseQueuer = new PromiseQueue();

      promiseQueuer.add(() => Promise.resolve(1));
      promiseQueuer.add(() => Promise.resolve(1));
      promiseQueuer.add(() => Promise.resolve(1));

      expect(promiseQueuer.promiseQueue.length).toBe(3);
      
      promiseQueuer.clear();
      expect(promiseQueuer.promiseQueue.length).toBe(0);
    });

    it('should return the number of removed promises from the queue', () => {
      const promiseQueuer = new PromiseQueue();

      promiseQueuer.add(() => Promise.resolve(1));
      promiseQueuer.add(() => Promise.resolve(1));
      promiseQueuer.add(() => Promise.resolve(1));

      expect(promiseQueuer.promiseQueue.length).toBe(3);
      
      const removedPromises = promiseQueuer.clear();
      expect(removedPromises).toBe(3);
    });
  });

  describe('run', () => {
    it('should unpause', () => {
      const promiseQueuer = new PromiseQueue();
      expect(promiseQueuer.paused).toBe(true);

      promiseQueuer.run();

      expect(promiseQueuer.paused).toBe(false);
    });
    it('should provision the processor pool', () => {
      const promiseQueuer = new PromiseQueue();

      expect(promiseQueuer.processorsPool.size).toBe(0);

      promiseQueuer.run(5);

      expect(promiseQueuer.processorsPool.size).toBe(5);
    });

    it('should use previously provisioned processors if no parameter is provided and the processor pool already exists', () => {
      const promiseQueuer = new PromiseQueue();

      promiseQueuer.processorsPool.addProcessors(2);
      expect(promiseQueuer.processorsPool.size).toBe(2);

      promiseQueuer.run();
      expect(promiseQueuer.processorsPool.size).toBe(2);
    });

    it('should provision at least 1 processor if no parameter is provided and there is no processor pool', () => {
      const promiseQueuer = new PromiseQueue();

      expect(promiseQueuer.processorsPool.size).toBe(0);

      promiseQueuer.run();

      expect(promiseQueuer.processorsPool.size).toBe(1);
    });

    it('should start running the first batch of promises based on the number of provisioned processors', () => {
      const promiseQueuer = new PromiseQueue();
      const promisesData = [1, 2, 3, 4, 5];
      const promisesCount = promisesData.length;
      const PARALLEL_PROMISES = 2;

      const promises = promisesData.map((i) => () => Promise.resolve(i));
      promises.forEach((promiseFn) => promiseQueuer.add(promiseFn));

      expect(promiseQueuer.promiseQueue.length).toBe(promisesCount);
      promiseQueuer.run(PARALLEL_PROMISES);
      promiseQueuer.pause();

      expect(promiseQueuer.processorsPool.runningCount).toBe(PARALLEL_PROMISES);
      expect(promiseQueuer.processorsPool.emptyCount).toBe(0);
      expect(promiseQueuer.promiseQueue.length).toBe(promisesCount - PARALLEL_PROMISES);
    });
  });

  describe('pause', () => {
    it('should pause', () => {
      const promiseQueuer = new PromiseQueue();
      promiseQueuer.run();
      expect(promiseQueuer.paused).toBe(false);

      promiseQueuer.pause();
      expect(promiseQueuer.paused).toBe(true);
    });

    it('should stop new promises executions', () => {
      const promiseQueuer = new PromiseQueue();

      promiseQueuer.add(() => Promise.resolve(1));
      promiseQueuer.add(() => Promise.resolve(2));

      promiseQueuer.run(1);
      promiseQueuer.pause();
      
      expect(promiseQueuer.promiseQueue.length).toBe(1);
    });
    it('should not stop running promises', (done) => {
      const promiseQueuer = new PromiseQueue();

      const promise1 = promiseQueuer.add(() => new Promise((r) => setTimeout(() => { r(1) }, 500)));
      const promise2 = promiseQueuer.add(() => Promise.resolve(2));

      promiseQueuer.run(1);
      promiseQueuer.pause();

      promise1.on(promise1.id, (error, data) => {
        expect(data).toBe(1);
        done();
      })

      promise2.on(promise2.id, () => { throw new Error('Should not run') }); 
    });
  });

  describe('resume', () => {
    it('should unpause', () => {
      const promiseQueuer = new PromiseQueue();
      expect(promiseQueuer.paused).toBe(true);

      promiseQueuer.resume();

      expect(promiseQueuer.paused).toBe(false);
    });

    it('should resume paused promises', () => {
      const promiseQueuer = new PromiseQueue();
      const promisesData = [1, 2, 3, 4, 5];
      const promisesCount = promisesData.length;
      const PARALLEL_PROMISES = 2;

      const promises = promisesData.map((i) => () => Promise.resolve(i));
      promises.forEach((promiseFn) => promiseQueuer.add(promiseFn));

      expect(promiseQueuer.promiseQueue.length).toBe(promisesCount);
      promiseQueuer.run(PARALLEL_PROMISES);
      promiseQueuer.pause();
      const promisesCountAfterPause = promisesCount - PARALLEL_PROMISES;
      expect(promiseQueuer.promiseQueue.length).toBe(promisesCountAfterPause);
      promiseQueuer.resume();

      expect(promiseQueuer.processorsPool.runningCount).toBe(PARALLEL_PROMISES);
      expect(promiseQueuer.processorsPool.emptyCount).toBe(0);
      expect(promiseQueuer.promiseQueue.length).toBe(promisesCountAfterPause - PARALLEL_PROMISES);
    });
  });

  describe('stop', () => {
    it('should pause', () => {
      const promiseQueuer = new PromiseQueue();
      promiseQueuer.run();
      expect(promiseQueuer.paused).toBe(false);

      promiseQueuer.stop();
      expect(promiseQueuer.paused).toBe(true);
    });

    it('should clear the queue', () => {
      const promiseQueuer = new PromiseQueue();

      promiseQueuer.add(() => Promise.resolve(1));
      promiseQueuer.add(() => Promise.resolve(2));

      promiseQueuer.stop();
      
      expect(promiseQueuer.promiseQueue.length).toBe(0);
    });

    it('should return the number of removed promises from the queue', () => {
      const promiseQueuer = new PromiseQueue();

      promiseQueuer.add(() => Promise.resolve(1));
      promiseQueuer.add(() => Promise.resolve(1));
      promiseQueuer.add(() => Promise.resolve(1));

      expect(promiseQueuer.promiseQueue.length).toBe(3);
      
      const removedPromises = promiseQueuer.stop();
      expect(removedPromises).toBe(3);
    });

    it('should not stop running promises', (done) => {
      const promiseQueuer = new PromiseQueue();

      const promise1 = promiseQueuer.add(() => new Promise((r) => setTimeout(() => { r(1) }, 500)));
      const promise2 = promiseQueuer.add(() => Promise.resolve(2));

      promiseQueuer.run(1);
      promiseQueuer.stop();

      promise1.on(promise1.id, (error, data) => {
        expect(data).toBe(1);
        done();
      })

      promise2.on(promise2.id, () => { throw new Error('Should not run') }); 
    });
  });
});