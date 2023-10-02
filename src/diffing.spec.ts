import { computeArrayDiff, computeDiff } from './DynamicForm';

describe('diffing functions', () => {
	describe('#computeArrayDiff()', () => {
		test('size check', () => {
			expect(computeArrayDiff([], [1]).hasDiff).toBeTruthy();
			expect(computeArrayDiff([], []).hasDiff).toBeFalsy();
		});
		test('element check', () => {
			expect(computeArrayDiff([1], [1]).hasDiff).toBeFalsy();
			expect(computeArrayDiff([1], [2]).hasDiff).toBeTruthy();
			expect(computeArrayDiff([1], ['1']).hasDiff).toBeTruthy();
		});
	});

	describe('#computeDiffs()', () => {
		const obj1 = {
			key: 'val',
			key2: ['val2', 1, '3'],
			key3: {
				sub1: 1,
				sub2: '2',
			},
		};
		const obj2 = {
			key: 'val111',
			key2: ['val2-x', 1, 3],
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
			expect(diff.diffs).toEqual({
				key: ['val', 'val111'],
				'key2[0]': ['val2', 'val2-x'],
				'key2[2]': ['3', 3],
				'key3/sub2': ['2', 2],
			});
		});
	});
});
