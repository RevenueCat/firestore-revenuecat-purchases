// this config includes typescript specific settings
// and if you're not using typescript, you should remove `transform` property
module.exports = {
    transform: {
        '^.+\\.tsx?$': 'ts-jest',
    },
    testRegex: 'src/__tests__/.+\.test.tsx?$',
    testPathIgnorePatterns: ['lib/', 'node_modules/'],
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
    testEnvironment: 'node',
    rootDir: 'src',
    setupFiles: ["<rootDir>/__tests__/setup-tests.ts"]
}