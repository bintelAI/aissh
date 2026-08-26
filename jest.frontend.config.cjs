module.exports = {
  rootDir: __dirname,
  testRegex: '(back/src/ssh/clone-session\\.spec|components/AISSH/services/logHistory\\.spec|components/AISSH/components/appLayout\\.spec)\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': '<rootDir>/back/node_modules/ts-jest/dist/index.js',
  },
  testEnvironment: 'node',
  modulePathIgnorePatterns: ['<rootDir>/.pnpm-store/'],
};
