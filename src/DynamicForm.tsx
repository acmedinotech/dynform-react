import React, {
	PropsWithChildren,
	createContext,
	useContext,
	useEffect,
	useRef,
} from 'react';

export type FormData = Record<string, any>;

export const ENCTYPE_MULTIPART = 'multi-part/form-data';
export const ENCTYPE_URLENCODED = 'application/x-www-form-urlencoded';
export const ENCTYPE_JSON = 'application/json';

/**
 * Allows non-standard component to act as a control when form is serialized.
 */
export const DATA_SIMULATED_CONTROL = 'data-dfr-control';
export const KEY_SIMULATED_CONTROL = 'dfrControl';
export const DATA_SCOPE = 'data-dfr-scope';
export const KEY_SCOPE = 'dfrScope';

export const isMultiple = (ctrl: any) => {
	return !!ctrl.multiple || ctrl.type == 'checkbox';
};

export type HookControlListener = (
	evetName: string,
	ctrl: HTMLElement,
	e: FocusEvent
) => void;
/**
 * Enhances individual controls in a form to allow DynamicForm to perform
 * extended lifecycle events:
 *
 * - `onBlur`: control's onBlur called first, then propagated to `listener()`
 * @param form
 * @param listener
 * @returns
 */
export const hookControlOnHandlers = (
	form: null | HTMLFormElement,
	listener: HookControlListener
) => {
	if (!form) {
		return;
	}

	// todo: on a hot refresh, previous onblur is also invoked
	form.querySelectorAll(
		'input, textarea, select, [' + DATA_SIMULATED_CONTROL + ']'
	).forEach((ele) => {
		const ctrl = ele as HTMLInputElement;
		if (ctrl.type === 'submit' || ctrl.type === 'button') {
			// ignore buttons
			return;
		}
		const oldBlur = ctrl.onblur;
		ctrl.onblur = (e) => {
			oldBlur?.call(ctrl, e);
			listener('blur', ctrl, e);
		};
	});
};

/**
 * An individual component in a `/`-separated path that references a whole object/array,
 * a specific array index, or a specific map key.
 *
 * - `name` -> `{name:'name'}`
 * - `name[]` -> `{name: 'name', isArray: true}`
 * - `name[0]` -> `{name: 'name', isArray: true, index: 0}`
 * - `name[alpha]` -> `{name: 'name', key: 'alpha'}`
 * - `[alpha]` -> `{name: '', key: 'alpha'}` is a special case that references previous
 *   resolved component data
 * - NOT ALLOWED: `[]` and `[index]` (previous resolved component data will always be an
 *   object, never an array)
 */
export type PathComponent = {
	name: string;
	isArray?: boolean;
	index?: number;
	key?: string;
};

/**
 * Convert raw path component to its parts.
 */
export const parsePathComponent = (component: string): PathComponent => {
	const [name, restIndex] = component.split('[');
	const ret: PathComponent = {
		name,
	};

	if (restIndex) {
		const [rawIndex] = restIndex.split(']');
		const index = parseInt(rawIndex);
		if (rawIndex) {
			if (isNaN(index)) {
				ret.key = rawIndex;
			} else {
				ret.isArray = true;
				ret.index = index;
			}
		} else {
			ret.isArray = true;
		}
	}

	return ret;
};

/**
 * Resolves a `/`-delimited path within an object, optionally executes an
 * insert callback with the resolved object, and returns the resolved object.
 * This allows for out-of-order, iterative graph creation,
 *
 * @param data
 * @param path
 * @return The object pointed to by the leaf component
 */
export const insertValueByPath = (
	data: FormData,
	path: string,
	insertFn?: (map: any) => void
): FormData => {
	let ptr = data;
	for (const component of path.split('/')) {
		if (component === '') {
			break;
		}

		// todo: guard against current `name` object being referenced as an array
		const { name, isArray, index, key } = parsePathComponent(component);
		let target = ptr;
		if (name && !ptr[name]) {
			if (isArray) {
				if (!ptr[name]) {
					ptr[name] = [];
					target = ptr[name];
				}
			} else {
				ptr[name] = {};
				target = ptr[name];
			}
		} else if (name) {
			target = ptr[name];
		} else if (isArray) {
			// unnamed []
			throw new Error(
				`unnamed array not allowed. failed parsing '${component}' in '${path}'`
			);
		}

		if (isArray) {
			const obj = {};
			if (index !== undefined) {
				// [index]
				target[index] = obj;
			} else {
				// []
				target.push(obj);
			}
			ptr = obj;
		} else {
			if (key) {
				if (!target[key]) {
					target[key] = {};
				}
				ptr = target[key];
			} else {
				ptr = target;
			}
		}
	}
	insertFn?.(ptr);
	return ptr;
};

/**
 * Iterates over all native and synthetic form controls and constructs a graph
 * of the current state of data. Container components can use `data-dfr-scope`
 * to define a deep leaf in the structure where nested control values will be
 * saved to.
 */
export const collectAllInputValues = (
	form: HTMLFormElement,
	context: DynamicFormContextProps,
	{ dataRef }: { dataRef?: FormData } = {}
) => {
	const data: FormData = dataRef ?? {};
	let anonId = 0;
	form.querySelectorAll(
		'input, textarea, select, [' + DATA_SIMULATED_CONTROL + ']'
	).forEach((ele) => {
		const ctrl = ele as HTMLInputElement;

		const key = ctrl.name || `anonymous-${ctrl.type}-${anonId++}`;
		let path = '/' + key;
		const scope = (ctrl.closest(`[${DATA_SCOPE}]`) as HTMLElement)?.dataset[
			KEY_SCOPE
		];
		if (scope) {
			path = scope + path;
		}

		insertValueByPath(data, path, (ptr: any) => {
			if (isMultiple(ctrl)) {
				if (ctrl instanceof HTMLSelectElement) {
					ptr[key] = [];
					for (const opt of ctrl.selectedOptions) {
						ptr[key].push(opt.value);
					}
				} else {
					if (ctrl.type === 'checkbox' && !ctrl.checked) {
						return;
					}

					// either create or append to key
					if (ptr[key] === undefined) {
						ptr[key] = [ctrl.value];
					} else {
						ptr[key].push(ctrl.value);
					}
				}
			} else {
				if (ctrl.type === 'radio' && !ctrl.checked) {
					return;
				} else if (ctrl.dataset[KEY_SIMULATED_CONTROL]) {
					const sid = ctrl.dataset[KEY_SIMULATED_CONTROL];
					const val = context.getSyntheticControlValue(sid);
					console.log({ KEY_SIMULATED_CONTROL, sid, val });
					if (val) {
						ptr[val.name] = val.value;
					}
				} else {
					ptr[key] = ctrl.value;
				}
			}
		});
	});

	return data;
};

export const computeArrayDiff = (oval: any[], nval: any[]): DiffResults => {
	const mydiff: DiffResults = {
		hasDiff: false,
		diffs: {},
	};

	const max = oval.length > nval.length ? oval.length : nval.length;
	let errs = 0;
	for (let i = 0; i < max; i++) {
		if (typeof oval[i] === 'object' && typeof nval[i] === 'object') {
			const _diff = computeDiff(oval[i], nval[i]);
			if (_diff.hasDiff) {
				mydiff.diffs[`[${i}]`] = [oval[i], nval[i]];
				errs++;
			}
		} else {
			if (oval[i] !== nval[i]) {
				mydiff.diffs[`[${i}]`] = [oval[i], nval[i]];
				errs++;
			}
		}
	}

	mydiff.hasDiff = !!errs;
	return mydiff;
};

/**
 * Does a deep traverse between two objects to compute changes. Each diff
 * is registered as path.
 */
export const computeDiff = (
	oval: FormData,
	nval: FormData,
	curpath = '',
	diff?: DiffResults
): DiffResults => {
	const prefix = curpath ? curpath + '/' : '';
	const curdiff = diff ?? { hasDiff: false, diffs: {} };

	const examined: Record<string, boolean> = {};
	const okeys = Object.keys(oval);
	const nkeys = Object.keys(nval);

	for (const okey of okeys) {
		examined[okey] = true;
		const ov = oval[okey];
		const nv = nval[okey];
		if (ov instanceof Array && nv instanceof Array) {
			const arrdiff = computeArrayDiff(ov, nv);
			if (arrdiff.hasDiff) {
				curdiff.hasDiff = true;
				for (const index in arrdiff.diffs) {
					curdiff.diffs[prefix + okey + index] = arrdiff.diffs[index];
				}
			}
		} else if (typeof ov === 'object' && typeof nv === 'object') {
			computeDiff(ov, nv, prefix + okey, curdiff);
		} else if (ov !== nv) {
			curdiff.hasDiff = true;
			curdiff.diffs[prefix + okey] = [ov, nv];
		}
	}

	return curdiff;
};

export type DynamicFormSubmitter = (
	data: FormData,
	config: DynamicFormProps
) => Promise<Response>;

/**
 * Submits the form based on action, method, and content encoding type.
 * Handles standard querystring/mutipart and JSON.
 */
export const defaultFormSubmitter: DynamicFormSubmitter = async (
	data,
	{ action = '', method = 'post', encType = ENCTYPE_MULTIPART }
) => {
	let body: any;

	if (encType === ENCTYPE_JSON) {
		body = JSON.stringify(data);
	} else {
		const fd =
			encType === ENCTYPE_URLENCODED
				? new URLSearchParams()
				: new FormData();
		for (const [key, value] of Object.entries(data)) {
			if (value instanceof Array) {
				for (const v of value) {
					fd.append(key, v);
				}
			} else {
				fd.append(key, value);
			}
		}
		body = fd;
	}

	return fetch(action, {
		method,
		headers: {
			'content-type': encType,
		},
		body,
	});
};

/**
 * Non-standard input components can register themselves as synthetic controls--
 * they register a getter that returns an object that loosely mimics an HTMLInputElement.
 */
export type SyntheticControlValue = {
	name: string;
	value: any;
};

export type SyntheticControlValueGetter = () =>
	| SyntheticControlValue
	| undefined;

/**
 * Reflects changes in form data. Each key in `diff` is `/`-separated to indicate nesting,
 * and each value is in the form `[oldValue, newValue]`.
 */
export type DiffResults = {
	hasDiff: boolean;
	diffs: Record<string, [any, any]>;
};

/**
 * Enables component tree to access the dynamic form to access/manipulate data.
 */
export type DynamicFormContextProps = {
	/** Reset state of form data. */
	initialData: FormData;
	/** Live state of form data. */
	refData: React.Ref<FormData>;
	/** A listener for detected changes. */
	controlUpdated: (diff: DiffResults) => void;
	/** Register a synthetic control */
	addSyntheticControl: (getter: SyntheticControlValueGetter) => string;
	/** Get current value of a synthetic control. */
	getSyntheticControlValue: (id: string) => SyntheticControlValue | undefined;
};

/**
 * Generates the default form context.
 *
 * Currently, synthetic control functions are not overrideable.
 */
export const makeDynFormContext = (
	p: Partial<
		Pick<DynamicFormContextProps, 'initialData' | 'controlUpdated'>
	> = {}
): DynamicFormContextProps => {
	const synthetic: Record<string, SyntheticControlValueGetter> = {};
	let simcount = 0;

	return {
		initialData: {},
		refData: { current: {} },
		controlUpdated: () => {},
		addSyntheticControl: (getter) => {
			const id = `${new Date().toISOString()}-${simcount++}`;
			synthetic[id] = getter;
			return id;
		},
		getSyntheticControlValue: (id) => synthetic[id]?.(),
		...p,
	};
};

export const DynamicFormContext = createContext(makeDynFormContext());

export type DynamicFormProps = {
	action?: string;
	method?: string;
	encType?: string;
	onSubmit?: DynamicFormSubmitter;
	afterSubmission?: (response: Response, data: FormData) => Promise<any>;
} & PropsWithChildren;

/**
 * An extension to native `<form/>` that is enhanced through:
 *
 * - self-reflection on form controls to construct arbitrarily complex data states
 * - easy support of JSON submissions
 * - notification of control changes through onBlur() detection and state comparison
 *
 */
export const DynamicForm = ({
	children,
	onSubmit = defaultFormSubmitter,
	afterSubmission,
	...props
}: DynamicFormProps) => {
	const ctx = useContext(DynamicFormContext);
	const ref = useRef<null | HTMLFormElement>(null);
	const refData = useRef<FormData>({});

	// even though ctx is created above, dynamicForm is charge of data state, so override context value here
	ctx.refData = refData;

	const listener: HookControlListener = (ename, ctrl, e) => {
		if (ename === 'blur') {
			const data = collectAllInputValues(
				ref.current as HTMLFormElement,
				ctx
			);

			const diff = computeDiff(refData.current, data);
			if (diff.hasDiff) {
				ctx.controlUpdated?.(diff);
				Object.assign(refData.current, data);
			}
		}
	};

	useEffect(() => {
		collectAllInputValues(ref.current as HTMLFormElement, ctx, {
			dataRef: refData.current,
		});
		hookControlOnHandlers(ref.current, listener);
		console.log('ℹ️ refData = ', refData.current);
	});

	return (
		<form
			{...props}
			ref={ref}
			onSubmit={(e) => {
				e.preventDefault();
				const data = collectAllInputValues(
					e.target as HTMLFormElement,
					ctx
				);
				// console.log('submit', data);
				defaultFormSubmitter(data, props).then((resp) => {
					return afterSubmission?.(resp, data);
				});
			}}
		>
			{children}
		</form>
	);
};
