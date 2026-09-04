const baseConfig = require('./jest.config.cjs');

module.exports = {
  ...baseConfig,
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/test/integration/'],
  testRegex: 'test/e2e/.*\\.spec\\.ts$',
};
