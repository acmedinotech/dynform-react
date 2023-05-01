import {
	composeValidatorNormalizer,
	FieldValidationError,
	ModelValidationError,
} from './validation';
describe('forms/validation', () => {
	const goodObj = { a: 2, b: 'two' };
	const badObj = { b: 'three' };

	const validator = composeValidatorNormalizer<typeof goodObj>({
		model: 'Test',
		validators: {
			a: (val: any) => {
				if (typeof val != 'number') {
					throw new FieldValidationError('must be number');
				}
			},
			b: (val: any) => {
				if (val !== 'two') {
					throw new FieldValidationError('must be "two"');
				}

				return val + '!';
			},
			'a&b': (val: typeof goodObj) => {
				if (val.a !== 2) {
					throw new ModelValidationError('', { a: 'expected 2' });
				}
			},
		},
	});

	it('validates and normalizes conforming object', () => {
		const n = validator(goodObj);
		expect(n.b).toEqual('two!');
	});
	it('fails validation of non-conforming object', () => {
		try {
			validator(badObj);
		} catch (err) {
			const e: any = err;
			expect(e.message).toEqual('Test: 2 validation errors');
			expect(e.getModel()).toEqual('Test');
			expect(e.getErrorMap()).toEqual(
				expect.objectContaining({
					a: 'must be number ; expected 2',
					b: 'must be "two"',
				})
			);
		}
	});
});
