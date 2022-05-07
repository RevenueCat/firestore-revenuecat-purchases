// this config includes typescript specific settings
// and if you're not using typescript, you should remove `transform` property
module.exports = {
  transform: {
    "^.+\\.tsx?$": "ts-jest",
  },
  testRegex: "/src/__tests__/.+.test.tsx?$",
  testPathIgnorePatterns: ["lib/", "node_modules/"],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json"],
  testEnvironment: "node",
  setupFiles: ["<rootDir>/src/__tests__/setup-tests.ts"],
  moduleNameMapper: {
    "firebase-admin/eventarc":
      "<rootDir>/node_modules/firebase-admin/lib/eventarc/index.js",
  },
};
