module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  moduleNameMapper: {
    '^react-native$': '<rootDir>/__mocks__/react-native.js',
    '^@react-native-community/netinfo$': '<rootDir>/__mocks__/@react-native-community/netinfo.js',
    '^expo-sqlite$': '<rootDir>/__mocks__/expo-sqlite.js',
    '^expo-task-manager$': '<rootDir>/__mocks__/expo-task-manager.js',
    '^expo-background-task$': '<rootDir>/__mocks__/expo-background-task.js',
    '^react-native-background-job$': '<rootDir>/__mocks__/react-native-background-job.js',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native-community|expo-*)/)',
  ],
};
