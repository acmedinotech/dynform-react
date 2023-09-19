import { areArraysSame, computeDiff } from './DynamicForm';

describe('diffing functions', () => {
	describe('#areArraysSame()', () => {
		test('size check', () => {
			expect(areArraysSame([], [1])).toBeFalsy();
			expect(areArraysSame([], [])).toBeTruthy();
		});
		test('element check', () => {
			expect(areArraysSame([1], [1])).toBeTruthy();
			expect(areArraysSame([1], [2])).toBeFalsy();
			expect(areArraysSame([1], ['1'])).toBeFalsy();
		});
	});

	describe('#computeDiffs()', () => {
		const obj1 = {
			key: 'val',
			key2: ['val2'],
			key3: {
				sub1: 1,
				sub2: '2',
			},
		};
		const obj2 = {
			key: 'val111',
			key2: ['val2-x'],
			key3: {
				sub1: 1,
				sub2: 2,
			},
		};

		test('same object', () => {
			expect(computeDiff(obj1, obj1).hasDiff).toBeFalsy();
		});
		test('different object', () => {
			const diff = computeDiff(obj1, obj2);
			expect(diff.hasDiff).toBeTruthy();
			expect(diff.diffs['key']).toEqual(['val', 'val111']);
			expect(diff.diffs['key2']).toEqual([['val2'], ['val2-x']]);
			expect(diff.diffs['key3/sub2']).toEqual(['2', 2]);
		});
	});
});
