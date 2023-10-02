import { FormData, insertValueByPath } from './DynamicForm';

describe('data collection functions', () => {
	describe('#insertValuesByPath()', () => {
		const data: FormData = {
			existing: {
				arr: [],
				map: {},
			},
		};

		test(`inserts 'name'`, () => {
			const comp = insertValueByPath(
				data,
				'name',
				(ptr) => (ptr['key'] = 1)
			);
			expect(data['name']).toEqual({ key: 1 });
		});

		test(`inserts 'name[k]/subkey'`, () => {
			const comp = insertValueByPath(data, 'name[k]/subkey');
			expect(data['name']['k']).toEqual({ subkey: {} });
		});

		test(`updates 'existing/arr[1]'`, () => {
			const comp = insertValueByPath(
				data,
				'existing/arr[0]',
				(ptr) => (ptr['key'] = 2)
			);
			expect(data['existing']['arr'][0]).toEqual({ key: 2 });
		});

		test(`updates 'existing/map[newkey]'`, () => {
			const comp = insertValueByPath(
				data,
				'existing/map[newkey]',
				(ptr) => (ptr['key'] = 3)
			);
			expect(data['existing']['map']['newkey']).toEqual({ key: 3 });
		});

		test(`creates '[rootkey]' at root`, () => {
			insertValueByPath(data, '[rootkey]');
			expect(data['rootkey']).toEqual({});
		});

		test.only(`creates 'existing/[rootkey]' at root`, () => {
			insertValueByPath(data, 'existing/[rootkey]');
			expect(data['existing']['rootkey']).toEqual({});
		});

		test(`fails '[]' and '[index]`, () => {
			expect(() => insertValueByPath(data, '[]')).toThrowError(
				`unnamed array not allowed. failed parsing '[]' in '[]'`
			);
			expect(() => insertValueByPath(data, '[0]')).toThrowError(
				`unnamed array not allowed. failed parsing '[0]' in '[0]'`
			);
		});

		test('full data matching', () => {
			expect(data).toEqual({
				name: {
					key: 1,
					k: {
						subkey: {},
					},
				},
				existing: {
					arr: [{ key: 2 }],
					map: {
						newkey: {
							key: 3,
						},
					},
					rootkey: {},
				},
				rootkey: {},
			});
		});
	});
});
