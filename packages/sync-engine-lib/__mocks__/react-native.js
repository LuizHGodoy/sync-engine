module.exports = {
  AppState: {
    currentState: 'active',
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
    removeEventListener: jest.fn(),
  },
  Platform: {
    OS: 'ios',
    Version: '14.0',
  },
};
