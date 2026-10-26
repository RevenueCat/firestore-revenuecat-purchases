module.exports = {
  transform: {
    "^.+\\.tsx?$": "ts-jest",
    // firebase-admin 14 pulls in jose, which only ships ES modules.
    "^.+/node_modules/jose/.+\\.js$": ["ts-jest", { tsconfig: { allowJs: true } }],
  },
  transformIgnorePatterns: ["/node_modules/(?!jose/)"],
  testRegex: "/src/__tests__/.+.test.tsx?$",
  testPathIgnorePatterns: ["lib/", "node_modules/"],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json"],
  testEnvironment: "node",
  setupFiles: ["<rootDir>/src/__tests__/setup-tests.ts"],
};
