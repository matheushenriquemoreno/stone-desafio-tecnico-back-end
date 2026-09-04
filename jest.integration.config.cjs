const baseConfig = require('./jest.config.cjs');

module.exports = {
  ...baseConfig,
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/test/e2e/'],
  testRegex: 'test/integration/.*\\.spec\\.ts$',
};
