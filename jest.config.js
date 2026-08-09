/**
 * Tests cover src/game/** only - the pure rules, solver, and generator.
 *
 * That layer imports nothing from React or React Native by design, so it runs
 * under plain ts-jest in Node. No Expo/RN test preset needed, and the whole
 * suite stays fast enough to run on every change.
 */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/__tests__'],
  testPathIgnorePatterns: ['/node_modules/', '/android/', '/ios/'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          jsx: 'react-jsx',
          esModuleInterop: true,
          // The app tsconfig has no "types", so ts-jest's inline override must
          // name them or describe/it/expect are unresolved here.
          types: ['jest', 'node'],
        },
      },
    ],
  },
};
