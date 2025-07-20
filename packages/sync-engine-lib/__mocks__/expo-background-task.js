module.exports = {
  registerTaskAsync: jest.fn(),
  unregisterTaskAsync: jest.fn(),
  isTaskRegisteredAsync: jest.fn(() => Promise.resolve(false)),
};
