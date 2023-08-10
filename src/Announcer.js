class Announcer {
  constructor() {
    this.channels = {
      all: {},
    };
  }

  subscribe(channel, callback, uniqueIdentifier) {
    if (!this.channels[channel]) {
      this.channels[channel] = {};
    }

    this.channels[channel][uniqueIdentifier] = callback;
  }

  unsubscribe(channel, uniqueIdentifier) {
    delete this.channels?.[channel]?.[uniqueIdentifier];
  }

  emit(channel, error, payload) {
    if (!this.channels?.[channel]) return;

    const channelCallbacks = Object.values(this.channels?.[channel]) ?? [];

    channelCallbacks.forEach((callback) => {
      callback?.(error, payload);
    });
  }
}

module.exports = Announcer;