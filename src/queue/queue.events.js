const { singletonAnnouncer } = require('../pub-sub');

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
  singletonAnnouncer.emit(ACTIONS.FINISH, error, { item, data });
};
const settledItem = (error, item, data) => {
  singletonAnnouncer.emit(item.id, error, data);
}
const abortedRunningItem = (error, item, processor) => {
  singletonAnnouncer.emit(ACTIONS.ABORT, error, { item , processor });
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
  settledItem,
  abortedRunningItem,
  availableProcessor,
  end,
};

module.exports = {
  ACTIONS,
  announce,
};
