export class FieldValidationError extends Error {}

export interface ModelValidationErrorInterface {
	message: string;

	getModel(): string;

	getErrorMap(): Record<string, string>;
}

export class ModelValidationError
	extends Error
	implements ModelValidationErrorInterface {
	_model: string;
	_errMap: Record<string, string>;

	constructor(model: string, errMap: Record<string, string> = {}) {
		super(`${model}: ${Object.keys(errMap).length} validation errors`);
		this._model = model;
		this._errMap = errMap;
	}

	getModel() {
		return this._model;
	}

	getErrorMap() {
		return { ...this._errMap };
	}
}

export const isModelValidationError = (
	o?: any
): o is ModelValidationErrorInterface => {
	return o.getModel && o.getErrorMap;
};

/**
 * Performs validation of input object. If validation fails, a `ModelValidationError`
 * should be thrown. Otherwise, the expected return value is expected to conform to
 * the type `T`.
 */
export type ModelValidatorNormalizer<T extends any> = (obj?: any) => T;

/**
 * If `val` fails, throw `FieldValidationError`. Otherwise, return optional normalized value.
 */
export type ValidationFn = (val?: any) => any;

/**
 * Factory for creating a model validation function using simple pattern:
 *
 * - give a map of `ValidationFn`
 * - each key in the map represents a field in `obj`
 * - if validation fails on a field, capture field error
 * - if more than 0 errors occurred, throw, otherwise, return normalized obj
 *
 * Note that the original key-values from the input object are copied first,
 * then overwritten with new normalized values.
 *
 * ## ValidatorFn map keys
 *
 * By default, each key is assumed to map to a property in the object. However,
 * there are some special cases:
 *
 * ### `*` (final validator)
 *
 * Invoked **after** all other properties are validated. Input is the obj var
 * and errors are reported as `*`
 *
 * ### `fieldName&fieldName2&...` (multi-field validator)
 *
 * Any key with `&` is assumed to be a multi-field validator against 2+ fields and are
 * evaluated after individual field validators. The obj var is given as an input.
 *
 * On error, `ModelValidationError` should be thrown containing the failing field(s) --
 * these messages will be joined to any existing errors using ` ; ` as a separator. Any
 * other error will appear as the original validationFn key.
 *
 * @param params `errClass` is a custom error to throw and is expected to follow the
 * `ModelValidationError`'s constructor order.
 * @throws ModelValidationError
 */
export const composeValidatorNormalizer = <T extends any = any>(params: {
	model: string;
	validators: Record<string, ValidationFn>;
	errClass?: typeof ModelValidationError;
	emptyErrorMessage?: string;
	postCleanup?: (obj: T) => T;
}): ModelValidatorNormalizer<T> => {
	return (obj?: any): T => {
		const errClass = params.errClass ?? ModelValidationError;

		if (!obj) {
			throw new errClass(params.model, {
				'*': params.emptyErrorMessage ?? 'object empty',
			});
		}

		const validators = params.validators;
		const finalValidator = validators['*'];
		delete validators['*'];

		// extract single-field keys
		const singleFields: string[] = [];
		const multiFields: string[] = [];
		for (const fkey of Object.keys(validators)) {
			if (!fkey.includes('&')) {
				singleFields.push(fkey);
			} else {
				multiFields.push(fkey);
			}
		}

		let norm: Record<string, any> = obj ? { ...obj } : {};
		let ecount = 0;
		let errs: Record<string, string> = {};
		for (const fieldName of singleFields) {
			try {
				const v = obj[fieldName];
				norm[fieldName] = validators[fieldName](v) ?? v;
			} catch (err) {
				const e = err as any;
				if (isModelValidationError(e)) {
					const m = e.getModel();
					const nerrs = e.getErrorMap();
					for (const ekey in nerrs) {
						errs[`${fieldName}.${ekey}`] = nerrs[ekey];
						ecount++;
					}
				} else {
					errs[fieldName] = e.message;
					ecount++;
				}
			}
		}

		for (const fieldName of multiFields) {
			try {
				validators[fieldName](norm);
			} catch (err) {
				const e = err as any;
				if (isModelValidationError(e)) {
					const nerrs = e.getErrorMap();
					for (const ekey in nerrs) {
						const existing = errs[ekey] ? errs[ekey] + ' ; ' : '';
						errs[ekey] = existing + nerrs[ekey];
						ecount++;
					}
				} else {
					errs[fieldName] = e.message;
					ecount++;
				}
			}
		}

		if (ecount) {
			throw new errClass(params.model, errs);
		}

		return params.postCleanup?.(norm as T) ?? (norm as T);
	};
};

/**
 * Returns a validator for integers. Accepts and converts string inputs.
 */
export const makeIntegerValidator = (invalidMessage: string): ValidationFn => {
	return (n: any) => {
		let norm = typeof n == 'string' ? parseInt(n) : n;
		if (typeof norm != 'number' || isNaN(norm) || !isFinite(norm)) {
			throw new FieldValidationError(invalidMessage);
		}
		return norm;
	};
};

export const makeRegexValidator = (
	pattern: RegExp,
	invalidMessage: string
): ValidationFn => {
	return (s: any) => {
		if (!pattern.test(s)) {
			throw new FieldValidationError(invalidMessage);
		}
	};
};

export const makeRequiredRegexValidator = (
	pattern: RegExp,
	invalidMessage: string
): ValidationFn => {
	const test = makeRegexValidator(pattern, invalidMessage);
	return (s: any) => {
		if (!s) {
			throw new FieldValidationError(invalidMessage);
		}
		test(s);
	};
};

export const validateAndNormalizeDate = (d?: any) => {
	if (d instanceof Date) {
		return d;
	}

	const tstamp = Date.parse(d);
	if (isNaN(tstamp)) {
		throw new FieldValidationError(`invalid date: ${d}`);
	}

	return new Date(tstamp);
};

/**
 * Throws error on the following:
 *
 * - `undefined` or `null`
 * - trimmed and empty string
 * - `false` (if flags.catchFalse)
 * - `0` (if flags.catchZero)
 *
 * @param invalidMessage
 * @param flags `catchZero` and `catchFalse` throw errors if value is strictly `0` or `false`
 */
export const makeRequiredValidator = (
	invalidMessage: string,
	flags = { catchZero: false, catchFalse: false }
): ValidationFn => {
	return (v: any) => {
		if (
			v === undefined ||
			v === null ||
			(typeof v == 'string' && v.trim() == '') ||
			(flags.catchZero && v === 0) ||
			(flags.catchFalse && v === false)
		) {
			throw new FieldValidationError(invalidMessage);
		}
	};
};
