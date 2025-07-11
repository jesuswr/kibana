/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

// For a detailed explanation regarding each configuration property, visit:
// https://jestjs.io/docs/en/configuration.html

/** @type {import("@jest/types").Config.InitialOptions} */
module.exports = {
  // The directory where Jest should output its coverage files
  coverageDirectory: '<rootDir>/target/kibana-coverage/jest',

  // An array of regexp pattern strings used to skip coverage collection
  coveragePathIgnorePatterns: ['/node_modules/', '.*\\.d\\.ts', 'jest\\.config\\.js'],

  // A list of reporter names that Jest uses when writing coverage reports
  coverageReporters: !!process.env.CODE_COVERAGE
    ? [['json', { file: 'jest.json' }]]
    : ['html', 'text'],

  // An array of file extensions your modules use
  moduleFileExtensions: ['ts', 'tsx', 'js', 'mjs', 'json', 'node'],

  moduleNameMapper: {
    // do not use these, they're so slow. We have a custom resolver that can handle resolving different types of requests.
  },

  // An array of regexp pattern strings, matched against all module paths before considered 'visible' to the module loader
  modulePathIgnorePatterns: ['__fixtures__/', 'target/'],

  // Use this configuration option to add custom reporters to Jest
  reporters: [
    'default',
    [
      '<rootDir>/src/platform/packages/shared/kbn-test/src/jest/junit_reporter',
      {
        rootDirectory: '.',
      },
    ],
    ...(process.env.TEST_GROUP_TYPE_UNIT
      ? [
          [
            '<rootDir>/src/platform/packages/shared/kbn-test/src/jest/ci_stats_jest_reporter.ts',
            {
              testGroupType: process.env.TEST_GROUP_TYPE_UNIT,
            },
          ],
        ]
      : []),
    ...(['1', 'yes', 'true'].includes(process.env.SCOUT_REPORTER_ENABLED)
      ? [
          [
            '<rootDir>/src/platform/packages/private/kbn-scout-reporting/src/reporting/jest',
            { name: 'Jest tests (unit)', configCategory: 'unit-test' },
          ],
        ]
      : []),
  ],

  // The paths to modules that run some code to configure or set up the testing environment before each test
  setupFiles: [
    '<rootDir>/src/setup_node_env/polyfill.ts',
    '<rootDir>/src/platform/packages/shared/kbn-test/src/jest/setup/polyfills.jsdom.js',
    '<rootDir>/src/platform/packages/shared/kbn-test/src/jest/setup/enzyme.js',
  ],

  // A list of paths to modules that run some code to configure or set up the testing framework before each test
  setupFilesAfterEnv: [
    '<rootDir>/src/platform/packages/shared/kbn-test/src/jest/setup/setup_test.js',
    '<rootDir>/src/platform/packages/shared/kbn-test/src/jest/setup/mocks.moment_timezone.js',
    '<rootDir>/src/platform/packages/shared/kbn-test/src/jest/setup/mocks.eui.js',
    '<rootDir>/src/platform/packages/shared/kbn-test/src/jest/setup/react_testing_library.js',
    '<rootDir>/src/platform/packages/shared/kbn-test/src/jest/setup/mocks.kbn_i18n_react.js',
    process.env.CI
      ? '<rootDir>/src/platform/packages/shared/kbn-test/src/jest/setup/disable_console_logs.js'
      : [],
  ].flat(),

  snapshotFormat: {
    escapeString: true,
    printBasicPrototype: true,
  },

  // A list of paths to snapshot serializer modules Jest should use for snapshot testing
  snapshotSerializers: [
    '<rootDir>/src/platform/packages/shared/react/kibana_mount/test_helpers/react_mount_serializer.ts',
    'enzyme-to-json/serializer',
    '<rootDir>/src/platform/packages/shared/kbn-test/src/jest/setup/emotion.js',
  ],

  // The test environment that will be used for testing
  testEnvironment: 'jest-environment-jsdom',

  // The glob patterns Jest uses to detect test files
  testMatch: ['**/*.test.{js,mjs,ts,tsx}'],

  // An array of regexp pattern strings that are matched against all test paths, matched tests are skipped
  testPathIgnorePatterns: [
    '<rootDir>/packages/kbn-ui-framework/dist/',
    '<rootDir>/packages/kbn-pm/dist/',
    `integration_tests/`,
  ],

  // A map from regular expressions to paths to transformers
  transform: {
    '^.+\\.(js|tsx?)$':
      '<rootDir>/src/platform/packages/shared/kbn-test/src/jest/transforms/babel/index.js',
    '^.+\\.(txt|html)?$':
      '<rootDir>/src/platform/packages/shared/kbn-test/src/jest/transforms/raw.js',
    '^.+\\.peggy?$': '<rootDir>/src/platform/packages/shared/kbn-test/src/jest/transforms/peggy.js',
    '^.+\\.text?$':
      '<rootDir>/src/platform/packages/shared/kbn-test/src/jest/transforms/dot_text.js',
  },

  // An array of regexp pattern strings that are matched against all source file paths, matched files will skip transformation
  transformIgnorePatterns: [
    // ignore all node_modules except monaco-editor, monaco-yaml which requires babel transforms to handle dynamic import()
    // since ESM modules are not natively supported in Jest yet (https://github.com/facebook/jest/issues/4842)
    '[/\\\\]node_modules(?![\\/\\\\](byte-size|monaco-editor|monaco-yaml|monaco-languageserver-types|monaco-marker-data-provider|monaco-worker-manager|vscode-languageserver-types|d3-interpolate|d3-color|langchain|langsmith|@cfworker|gpt-tokenizer|flat|@langchain|eventsource-parser|fast-check|@fast-check/jest|@assemblyscript|quickselect|rbush))[/\\\\].+\\.js$',
    'packages/kbn-pm/dist/index.js',
    '[/\\\\]node_modules(?![\\/\\\\](langchain|langsmith|@langchain))/dist/[/\\\\].+\\.js$',
    '[/\\\\]node_modules(?![\\/\\\\](langchain|langsmith|@langchain))/dist/util/[/\\\\].+\\.js$',
  ],

  // An array of regexp pattern strings that are matched against all source file paths, matched files to include/exclude for code coverage
  collectCoverageFrom: [
    '**/*.{js,mjs,jsx,ts,tsx}',
    '!**/{__test__,__snapshots__,__examples__,*mock*,tests,test_helpers,integration_tests,types}/**/*',
    '!**/*mock*.{ts,tsx}',
    '!**/*.test.{ts,tsx}',
    '!**/*.d.ts',
    '!**/index.{js,ts,tsx}',
  ],

  watchPathIgnorePatterns: ['.*/__tmp__/.*'],

  resolver: '<rootDir>/src/platform/packages/shared/kbn-test/src/jest/resolver.js',

  // Workaround to "TypeError: Cannot assign to read only property 'structuredClone' of object '[object global]'"
  // This happens when we run jest tests with --watch after node20+
  globals: {
    structuredClone: {},
  },

  testResultsProcessor:
    '<rootDir>/src/platform/packages/shared/kbn-test/src/jest/result_processors/logging_result_processor.js',
};
