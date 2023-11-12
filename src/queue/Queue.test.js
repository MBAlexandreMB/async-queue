const Queue = require("./Queue");

describe('Queue', () => {
  describe('add', () => {
    it('should not add a promise without a wrapper function', () => {
      const asyncQueue = new Queue();

      asyncQueue.add(Promise.resolve(1));
      
      expect(asyncQueue.queue.length).toBe(0);
      asyncQueue.destroy();
    });

    it('should add a callback that returns a promise', () => {
      const asyncQueue = new Queue();

      asyncQueue.add(() => Promise.resolve(1));
      
      expect(asyncQueue.queue.length).toBe(1);
      asyncQueue.destroy();
    });

    it('should add a description to the item, when supplied', () => {
      const asyncQueue = new Queue();
      const description = 'This is a description';

      asyncQueue.add(() => Promise.resolve(1), description);
      const addedItem = asyncQueue.queue[0];

      expect(addedItem.description).toBe(description);
      asyncQueue.destroy();
    });

    it('should use the provided identifier, when supplied', () => {
      const asyncQueue = new Queue();
      const providedId = '123Test123';

      asyncQueue.add(() => Promise.resolve(1), null, providedId);
      const addedItem = asyncQueue.queue[0];

      expect(addedItem.id).toBe(providedId);
      asyncQueue.destroy();
    });
  });

  describe('remove', () => {
    it('should return 1, when succeded for 1 item in the queue', () => {
      const asyncQueue = new Queue();
      const { id } = asyncQueue.add(() => Promise.resolve(1));
      
      const removedItems = asyncQueue.remove(id);
      expect(removedItems).toBe(1);
      asyncQueue.destroy();
    });

    it('should return the number of removed items, when succeded', () => {
      const asyncQueue = new Queue();
      const equalId = 'id123';

      asyncQueue.add(() => Promise.resolve(1), null, equalId);
      asyncQueue.add(() => Promise.resolve(1), null, equalId);
      
      const removedItems = asyncQueue.remove(equalId);
      expect(removedItems).toBe(2);
      asyncQueue.destroy();
    });

    it('should remove the item with the provided identifier from the queue', () => {
      const asyncQueue = new Queue();
      const { id } = asyncQueue.add(() => Promise.resolve(1));
      const added = asyncQueue.queue.find((item) => item.id === id);
      
      expect(added).not.toBeUndefined();
      
      asyncQueue.remove(id);
      expect(asyncQueue.queue.length).toBe(0);

      const removedItem = asyncQueue.queue.find((item) => item.id === id);
      expect(removedItem).toBeUndefined();
      asyncQueue.destroy();
    });

    it('should not remove any item if the provided id is not in the queue', () => {
      const asyncQueue = new Queue();
      asyncQueue.add(() => Promise.resolve(1));
  
      expect(asyncQueue.queue.length).toBe(1);
      
      asyncQueue.remove('otherId');
      expect(asyncQueue.queue.length).toBe(1);
      asyncQueue.destroy();
    });
  
    it('should return 0 when the provided id is not in the queue', () => {
      const asyncQueue = new Queue();
      asyncQueue.add(() => Promise.resolve(1));
      
      const removedItems = asyncQueue.remove('otherId');
      expect(removedItems).toBe(0);
      asyncQueue.destroy();
    });
  
  });

  describe('clear', () => {
    it('should remove all items from the queue', () => {
      const asyncQueue = new Queue();

      asyncQueue.add(() => Promise.resolve(1));
      asyncQueue.add(() => Promise.resolve(1));
      asyncQueue.add(() => Promise.resolve(1));

      expect(asyncQueue.queue.length).toBe(3);
      
      asyncQueue.clear();
      expect(asyncQueue.queue.length).toBe(0);
      asyncQueue.destroy();
    });

    it('should return the number of removed items from the queue', () => {
      const asyncQueue = new Queue();

      asyncQueue.add(() => Promise.resolve(1));
      asyncQueue.add(() => Promise.resolve(1));
      asyncQueue.add(() => Promise.resolve(1));

      expect(asyncQueue.queue.length).toBe(3);
      
      const removedItems = asyncQueue.clear();
      expect(removedItems).toBe(3);
      asyncQueue.destroy();
    });
  });

  describe('run', () => {
    it('should unpause', () => {
      const asyncQueue = new Queue();
      expect(asyncQueue.paused).toBe(true);

      asyncQueue.run();

      expect(asyncQueue.paused).toBe(false);
      asyncQueue.destroy();
    });
    it('should provision the processor pool', () => {
      const asyncQueue = new Queue();

      expect(asyncQueue.processorsPool.size).toBe(0);

      asyncQueue.run(5);

      expect(asyncQueue.processorsPool.size).toBe(5);
      asyncQueue.destroy();
    });

    it('should use previously provisioned processors if no parameter is provided and the processor pool already exists', () => {
      const asyncQueue = new Queue();

      asyncQueue.processorsPool.addProcessors(2);
      expect(asyncQueue.processorsPool.size).toBe(2);

      asyncQueue.run();
      expect(asyncQueue.processorsPool.size).toBe(2);
      asyncQueue.destroy();
    });

    it('should provision at least 1 processor if no parameter is provided and there is no processor pool', () => {
      const asyncQueue = new Queue();

      expect(asyncQueue.processorsPool.size).toBe(0);

      asyncQueue.run();

      expect(asyncQueue.processorsPool.size).toBe(1);
      asyncQueue.destroy();
    });

    it('should start running the first batch of items based on the number of provisioned processors', () => {
      const asyncQueue = new Queue();
      const itemsData = [1, 2, 3, 4, 5];
      const itemsCount = itemsData.length;
      const PARALLEL_ITEMS = 2;

      const items = itemsData.map((i) => () => Promise.resolve(i));
      items.forEach((itemFn) => asyncQueue.add(itemFn));

      expect(asyncQueue.queue.length).toBe(itemsCount);
      asyncQueue.run(PARALLEL_ITEMS);
      asyncQueue.pause();

      expect(asyncQueue.processorsPool.runningCount).toBe(PARALLEL_ITEMS);
      expect(asyncQueue.processorsPool.emptyCount).toBe(0);
      expect(asyncQueue.queue.length).toBe(itemsCount - PARALLEL_ITEMS);
      asyncQueue.destroy();
    });
  });

  describe('pause', () => {
    it('should pause', () => {
      const asyncQueue = new Queue();
      asyncQueue.run();
      expect(asyncQueue.paused).toBe(false);

      asyncQueue.pause();
      expect(asyncQueue.paused).toBe(true);
      asyncQueue.destroy();
    });

    it('should stop new items executions', () => {
      const asyncQueue = new Queue();

      asyncQueue.add(() => Promise.resolve(1));
      asyncQueue.add(() => Promise.resolve(2));

      asyncQueue.run(1);
      asyncQueue.pause();
      
      expect(asyncQueue.queue.length).toBe(1);
      asyncQueue.destroy();
    });

    it('should not stop running items if not aborting running items', (done) => {
      const asyncQueue = new Queue();
      const onReturn = (error, data, shouldResolve) => {
        asyncQueue.destroy();

        if (error && shouldResolve) {
          throw new Error('Should have resolved');
        }

        if (!shouldResolve) {
          throw new Error('Should not run');
        }

        if (data && shouldResolve) {
          expect(data).toBe(1);
          done();
        }
      };


      asyncQueue.add(
        () => new Promise((r) => setTimeout(() => { r(1) }, 500)),
        null,
        null,
        (error, data) => onReturn(error, data, true),
      );
      asyncQueue.add(
        () => Promise.resolve(2),
        null,
        null,
        (error, data) => onReturn(error, data, false),
      );

      asyncQueue.run(1);
      setTimeout(() => {
        asyncQueue.pause(false);
      }, 0);
    });

    it('should abort running items (signal)', (done) => {
      const asyncQueue = new Queue();

      // Adds a promise that makes the test pass if signal is aborted
      asyncQueue.add(
        ({ signal }) => new Promise(() => {
          setTimeout(() => {
            asyncQueue.destroy();

            if (signal.aborted) {
              done();
              return;
            }

            throw new Error('Should have been rejected');
          }, 0);
        }),
      );

      asyncQueue.run(1);
      // As asyncQueue.run functionality is async, we need to wait it to start to be able to pause it 
      setTimeout(() => asyncQueue.pause(true), 0);
    });

    it('should re-add execution cancelled items to the queue', (done) => {
      const asyncQueue = new Queue({ reAddAbortedItems: true });

      asyncQueue.add(() => new Promise((resolve) => setTimeout(() => resolve(1), 100)));
      asyncQueue.add(() => new Promise((resolve) => setTimeout(() => resolve(2), 100)));

      asyncQueue.run(1);
      setTimeout(() => asyncQueue.pause(true), 0);
      
      // The readdition to the queue needs to wait for the abort event
      setTimeout(() => {
        expect(asyncQueue.queue.length).toBe(2);
        asyncQueue.destroy();
        done();
      }, 1000);
    });
  });

  describe('resume', () => {
    it('should unpause', () => {
      const asyncQueue = new Queue();
      expect(asyncQueue.paused).toBe(true);

      asyncQueue.resume();

      expect(asyncQueue.paused).toBe(false);
      asyncQueue.destroy();
    });

    it('should resume paused items', () => {
      const asyncQueue = new Queue();
      const itemsData = [1, 2, 3, 4, 5];
      const itemsCount = itemsData.length;
      const PARALLEL_ITEMS = 2;

      itemsData.map((i) => asyncQueue.add(() => Promise.resolve(i)));

      expect(asyncQueue.queue.length).toBe(itemsCount);
      asyncQueue.run(PARALLEL_ITEMS);
      asyncQueue.pause();
      const itemsCountAfterPause = itemsCount - PARALLEL_ITEMS;
      expect(asyncQueue.queue.length).toBe(itemsCountAfterPause);

      // Awaits running promises to stop before resuming them
      setTimeout(() => {
        asyncQueue.resume();
      
        expect(asyncQueue.processorsPool.runningCount).toBe(PARALLEL_ITEMS);
        expect(asyncQueue.processorsPool.emptyCount).toBe(0);
        expect(asyncQueue.queue.length).toBe(itemsCountAfterPause - PARALLEL_ITEMS);
        asyncQueue.destroy();
      }, 0);
    });
  });

  describe('stop', () => {
    it('should pause', () => {
      const asyncQueue = new Queue();
      asyncQueue.run();
      expect(asyncQueue.paused).toBe(false);

      asyncQueue.stop();
      expect(asyncQueue.paused).toBe(true);
      asyncQueue.destroy();
    });

    it('should clear the queue', () => {
      const asyncQueue = new Queue();

      asyncQueue.add(() => Promise.resolve(1));
      asyncQueue.add(() => Promise.resolve(2));

      asyncQueue.stop();
      
      expect(asyncQueue.queue.length).toBe(0);
      asyncQueue.destroy();
    });

    it('should return the number of removed items from the queue', () => {
      const asyncQueue = new Queue();

      asyncQueue.add(() => Promise.resolve(1));
      asyncQueue.add(() => Promise.resolve(1));
      asyncQueue.add(() => Promise.resolve(1));

      expect(asyncQueue.queue.length).toBe(3);
      
      const removedItems = asyncQueue.stop();
      expect(removedItems).toBe(3);
      asyncQueue.destroy();
    });

    it('should not stop running items', (done) => {
      const asyncQueue = new Queue();

      const item1 = asyncQueue.add(() => new Promise((r) => setTimeout(() => { r(1) }, 500)));
      const item2 = asyncQueue.add(() => Promise.resolve(2));

      asyncQueue.run(1);
      asyncQueue.stop();

      asyncQueue.eventListener.on(item1.id, (error, data) => {
        expect(data).toBe(1);
        asyncQueue.destroy();
        done();
      });

      asyncQueue.eventListener.on(item2.id, () => {
        asyncQueue.destroy();
        throw new Error('Should not run');
      });
    });
  });
});