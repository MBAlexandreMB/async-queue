function* generateUniqueId() {
  for (let i = 0; i < Infinity; i += 1) {
    const dateInMs = new Date().getTime().toString();
  
    yield dateInMs + i;
  }
}

const generator = generateUniqueId();

const uniqueId = () => generator.next().value;

module.exports = uniqueId;