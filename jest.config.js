/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
	roots: ['<rootDir>/src'],
	setupFilesAfterEnv: [],
	preset: 'ts-jest',
	testEnvironment: 'node',
	verbose: true,
	testMatch: ['<rootDir>/src/**/*.spec.ts*'],
	moduleFileExtensions: ['tsx', 'ts', 'js'],
	transform: {
		'^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.jest.json' }],
		'^.+\\.tsx?$': ['babel-jest'],
	},
	moduleNameMapper: {
		'^dynform-react/(.*)': '<rootDir>/src/$1',
	},
};
