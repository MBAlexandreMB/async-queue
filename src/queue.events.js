const { singletonAnnouncer } = require('./Announcer');

const ACTIONS = Object.freeze({
  ADD: 'ADDED',
  DELETE: 'DELETED',
  RUN: 'RUNNING',
  FINISH: 'FINISHED',
  ABORT: 'ABORTED',
  AVAILABLE_PROCESSOR: 'AVAILABLE_PROCESSOR',
  END: 'END',
});

const addedItem = (error, item) => {
  singletonAnnouncer.emit(ACTIONS.ADD, error, item);
};
const removedItem = (error, item) => {
  singletonAnnouncer.emit(ACTIONS.DELETE, error, item);
};
const startedRunningItem = (processor, item) => {
  singletonAnnouncer.emit(ACTIONS.RUN, null, { processor, item });
};
const finishedRunningItem = (error, item, data) => {
  singletonAnnouncer.emit(item.id, error, data);
  singletonAnnouncer.emit(ACTIONS.FINISH, error, { item, data });
};
const abortedRunningItem = (error, item) => {
  singletonAnnouncer.emit(ACTIONS.ABORT, error, item);
};
const availableProcessor = (processor) => {
  singletonAnnouncer.emit(ACTIONS.AVAILABLE_PROCESSOR, null, processor);
}
const end = () => {
  singletonAnnouncer.emit(ACTIONS.END);
}

const announce = {
  addedItem,
  removedItem,
  startedRunningItem,
  finishedRunningItem,
  abortedRunningItem,
  availableProcessor,
  end,
};

module.exports = {
  ACTIONS,
  announce,
};
