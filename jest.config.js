module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/test/**/*.test.ts'],
  // get-port v7 ships ESM only; jest would otherwise fail to require it.
  moduleNameMapper: {
    '^get-port$': '<rootDir>/test/stubs/get-port.js'
  }
};
