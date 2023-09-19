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

/**
 * Components marked as a simulated control are expected to have `getValue()` to
 * return the current value.
 */
export type SimulatedControl = {
	getValue: () => any;
};

export const isMultiple = (ctrl: any) => {
	return !!ctrl.multiple || ctrl.type == 'checkbox';
};

export const isSimulatedControl = (ctrl: any): ctrl is SimulatedControl =>
	ctrl?.dataset[KEY_SIMULATED_CONTROL] !== undefined;

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
		const oldBlur = ctrl.onblur;
		ctrl.onblur = (e) => {
			oldBlur?.call(ctrl, e);
			listener('blur', ctrl, e);
		};
	});
};

/**
 * Expands a `/`-delimited path within an object, where each component refers
 * to a key of the previous component object. If a component doesn't exist, it's
 * created.
 *
 * @param data
 * @param path
 * @return The object pointed to by the leaf component
 */
export const createAndGetPath = (data: FormData, path: string): FormData => {
	let ptr = data;
	for (const component of path.split('/')) {
		if (!ptr[component]) {
			ptr[component] = {};
		}
		ptr = ptr[component];
	}
	return ptr;
};

export const collectAllInputValues = (
	form: HTMLFormElement,
	context: DynamicFormContextProps,
	// todo: add matchName
	{ dataRef }: { dataRef?: FormData } = {}
) => {
	const data: FormData = dataRef ?? {};
	let anonId = 0;
	form.querySelectorAll(
		'input, textarea, select, [' + DATA_SIMULATED_CONTROL + ']'
	).forEach((ele) => {
		// todo: find data-dfr-name-prefix
		const ctrl = ele as HTMLInputElement;

		let ptr = data;
		const scope = (ctrl.closest(`[${DATA_SCOPE}]`) as HTMLElement)?.dataset[
			KEY_SCOPE
		];
		if (scope) {
			ptr = createAndGetPath(ptr, scope);
		}

		// console.log('control: ', ctrl, ' data: ', data);
		const key = ctrl.name || `anonymous-${ctrl.type}-${anonId++}`;
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
				const val = context.getSimulatedControlValue(sid);
				console.log({ sid, val });
				if (val) {
					ptr[val.key] = val.value;
				}
			} else {
				ptr[key] = ctrl.value;
			}
		}
	});

	return data;
};

export const areArraysSame = (oval: any[], nval: any[]): boolean => {
	if (oval.length !== nval.length) {
		return false;
	}
	for (const i in oval) {
		if (oval[i] !== nval[i]) {
			return false;
		}
	}
	return true;
};

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
			if (!areArraysSame(ov, nv)) {
				curdiff.hasDiff = true;
				curdiff.diffs[prefix + okey] = [ov, nv];
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

export type SimulatedControlValue = {
	key: string;
	value: any;
};

export type SimulatedControlValueGetter = () =>
	| SimulatedControlValue
	| undefined;

/**
 * Reflects changes in form data. Each key in `diff` is `/`-separated to indicate nesting,
 * and each value is in the form `[oldValue, newValue]`.
 */
export type DiffResults = {
	hasDiff: boolean;
	diffs: Record<string, [any, any]>;
};

export type DynamicFormContextProps = {
	initialData: FormData;
	controlUpdated: (diff: DiffResults) => void;
	addSimulatedControl: (getter: SimulatedControlValueGetter) => string;
	getSimulatedControlValue: (id: string) => SimulatedControlValue | undefined;
};

/**
 * Generates the default form context.
 *
 * Currently, simulated control functions are not overrideable.
 */
export const makeDynFormContext = (
	p: Partial<
		Pick<DynamicFormContextProps, 'initialData' | 'controlUpdated'>
	> = {}
): DynamicFormContextProps => {
	const simulated: Record<string, SimulatedControlValueGetter> = {};
	let simcount = 0;

	return {
		initialData: {},
		controlUpdated: () => {},
		addSimulatedControl: (getter) => {
			const id = `${new Date().toISOString()}-${simcount++}`;
			simulated[id] = getter;
			return id;
		},
		getSimulatedControlValue: (id) => simulated[id]?.(),
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
	onControlValueChange?: (name: string, newVal: any, oldVal: any) => void;
} & PropsWithChildren;

/**
 * An extension to native `<form/>` that is enhanced through:
 *
 * - easy support of JSON submissions
 * - notification of control changes through onBlur() detection and state comparison
 */
export const DynamicForm = ({
	children,
	onSubmit = defaultFormSubmitter,
	afterSubmission,
	onControlValueChange,
	...props
}: DynamicFormProps) => {
	const ctx = useContext(DynamicFormContext);
	const ref = useRef<null | HTMLFormElement>(null);
	const refData = useRef<FormData>({});

	const listener: HookControlListener = (ename, ctrl, e) => {
		// console.log('listener: ', ename, ctrl, e);
		if (ename === 'blur') {
			const key = (ctrl as HTMLFormElement).name;
			console.log(
				'-> blur ',
				ctrl,
				' ;; scope = ',
				ctrl.closest(`[${DATA_SCOPE}]`)
			);
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
		console.log('-> refData = ', refData.current);
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
