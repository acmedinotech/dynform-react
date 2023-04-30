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
		expect(n.b).eq('two!');
	});
	it('fails validation of non-conforming object', () => {
		try {
			validator(badObj);
		} catch (e) {
			expect(e.message).eq('Test: 2 validation errors');
			expect(e.getModel()).eq('Test');
			expect(e.getErrorMap()).to.contain({
				a: 'must be number ; expected 2',
				b: 'must be "two"',
			});
		}
	});
});
