import EventEmitter from 'events';
import type { MutableRefObject, PropsWithChildren } from 'react';
import React, { createContext, useContext, useEffect, useRef } from 'react';

export type FormData = Record<string, any>;

export const ENCTYPE_MULTIPART = 'multi-part/form-data';
export const ENCTYPE_URLENCODED = 'application/x-www-form-urlencoded';
export const ENCTYPE_JSON = 'application/json';

/**
 * Allows non-standard component to act as a control when form is serialized.
 */
export const DATA_SYNTHETIC_CONTROL = 'data-dfr-synthetic-control';
export const KEY_SYNTHETIC_CONTROL = 'dfrSyntheticControl';
export const DATA_SCOPE = 'data-dfr-scope';
export const KEY_SCOPE = 'dfrScope';

export const isMultiple = (ctrl: any) => {
	return !!ctrl.multiple || ctrl.type == 'checkbox';
};

export const cloneObj = (obj: any) => JSON.parse(JSON.stringify(obj));

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
	form: null | HTMLElement,
	listener: HookControlListener
) => {
	if (!form) {
		return;
	}

	// todo: on a hot refresh, previous onblur is also invoked
	form.querySelectorAll(
		'input, textarea, select, [' + DATA_SYNTHETIC_CONTROL + ']'
	).forEach((ele) => {
		const ctrl = ele as HTMLInputElement;
		if (
			ctrl.type === 'submit' ||
			ctrl.type === 'button' ||
			ctrl.type === 'hidden'
		) {
			return;
		} else if (ctrl.dataset['dfrHook']) {
			return;
		}

		ctrl.dataset['dfrHook'] = '1';
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
			if (index !== undefined) {
				// [index]
				target[index] = target[index] ?? {};
				ptr = target[index];
			} else {
				// []
				target.push({});
				ptr = target[target.length - 1];
			}
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

export const getScope = (ele: HTMLElement) => {
	return (
		(ele.closest(`[${DATA_SCOPE}]`) as HTMLElement)?.dataset[KEY_SCOPE] ??
		''
	);
};

/**
 * Iterates over all native and synthetic form controls and constructs a graph
 * of the current state of data. Container components can use `data-dfr-scope`
 * to define a deep leaf in the structure where nested control values will be
 * saved to.
 * @param rootEle A control container (e.g. `<form/>`)
 * @param context The context of the form calling this
 * @param options `collectSubForms` signals that this call should also look at
 * all registered subForms and collect input values into the data set before returning
 */
export const collectAllInputValues = (
	rootEle: HTMLElement,
	context: DynamicFormContextProps,
	options: { dataRef?: FormData; collectSubforms?: boolean } = {}
) => {
	// console.log('#####');
	const { dataRef, collectSubforms } = options;
	const data: FormData = dataRef ?? {};
	let anonId = 0;
	rootEle
		.querySelectorAll(
			'input, textarea, select, [' + DATA_SYNTHETIC_CONTROL + ']'
		)
		.forEach((ele) => {
			const ctrl = ele as HTMLInputElement;

			const key = ctrl.name || `anonymous-${ctrl.type}-${anonId++}`;
			const path = getScope(ctrl);

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
					} else if (ctrl.dataset[KEY_SYNTHETIC_CONTROL]) {
						const sid = ctrl.dataset[KEY_SYNTHETIC_CONTROL];
						const val = context.getSyntheticControlValue(sid);
						console.log({
							KEY_SIMULATED_CONTROL: KEY_SYNTHETIC_CONTROL,
							sid,
							val,
						});
						if (val) {
							ptr[val.name] = val.value;
						}
					} else {
						ptr[key] = ctrl.value;
					}
				}
			});
		});

	if (collectSubforms) {
		for (const subForm of context.getSubForms()) {
			collectAllInputValues(subForm, context, { dataRef: data });
		}
	}

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

const mergeArrays = (arr1: string[], arr2: string[]) => {
	const examined: any = {};
	for (const ele of arr1) {
		examined[ele] = true;
	}
	for (const ele of arr2) {
		examined[ele] = true;
	}
	return Object.keys(examined);
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

	for (const okey of mergeArrays(Object.keys(oval), Object.keys(nval))) {
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
 * - `hook-controls`: triggers hooking inputs that may have been hidden previously. args are `HTMLElement`
 * - `detect-changes`: re-scans form and may trigger `control-update`. args are `any`
 * - `control-update`: emitted when changes are detected. args are `{diff:DiffResults, scope:string}`
 * - `set-initial-data`: sets new initial state. may trigger `control-update`. args are `data:FormData`
 * - `submit-start`: signals start of submission. args are `{data: FormData}`
 * - `submit-end`: signals end of submission. args are `{data: FormData, response: Response}`
 * - `reset`: TBD
 */
export type EventNames =
	| 'hook-controls'
	| 'detect-changes'
	| 'control-update'
	| 'set-initial-data'
	| 'reset'
	| 'submit-start'
	| 'submit-end';

export type EventListener = (eventName: EventNames, payload: any) => void;

/**
 * Enables component tree to access the dynamic form to access/manipulate data.
 */
export type DynamicFormContextProps = {
	/** Clean data state. */
	initialData: FormData;
	/** Current data state. */
	curDataRef: React.MutableRefObject<FormData>;
	setInitialData: (data: FormData, atPath?: string) => void;
	setCurrentData: (data: FormData, atPath?: string) => void;
	/** Register a synthetic control */
	addSyntheticControl: (getter: SyntheticControlValueGetter) => string;
	/** Get current value of a synthetic control. */
	getSyntheticControlValue: (id: string) => SyntheticControlValue | undefined;
	/**
	 *
	 * @param eventName
	 * @param listener
	 * @returns Unsubscribe callback.
	 */
	listenFor: (eventName: EventNames, listener: EventListener) => () => void;
	emit: (eventName: EventNames, payload: any) => void;
	/**
	 * For situations where a modal or popover that contains form controls is opened,
	 * the embedded controls are outside the scope of the root form--in order to include
	 * these, we need a mechanism to register other subForms (i.e. control containers).
	 * @param ele
	 * @returns
	 */
	addSubForm: (ele: null | HTMLElement) => void;
	getSubForms: () => HTMLElement[];
	// todo: add removeSubForm(ele)?

	onSubmit: DynamicFormSubmitter;
};

/**
 * Generates the default form context.
 *
 * Currently, synthetic control functions are not overrideable.
 */
export const makeDynFormContext = (
	p: Partial<Pick<DynamicFormContextProps, 'initialData' | 'onSubmit'>> = {}
): DynamicFormContextProps => {
	const synthetic: Record<string, SyntheticControlValueGetter> = {};
	const initialData = p.initialData ?? {};
	const curDataRef: MutableRefObject<FormData> = {
		current: cloneObj(initialData),
	};

	let simcount = 0;

	const eventBus = new EventEmitter({});
	eventBus.setMaxListeners(64);

	const subForms: HTMLElement[] = [];
	const emit: DynamicFormContextProps['emit'] = (ename, payload) => {
		eventBus.emit(ename, ename, payload);
	};

	return {
		initialData,
		curDataRef,
		setInitialData: (data, atPath) => {
			if (atPath) {
				insertValueByPath(initialData, atPath, (ptr) => {
					Object.assign(ptr, data);
				});
			} else {
				Object.assign(initialData, data);
			}
		},
		setCurrentData: (data, atPath) => {
			if (atPath) {
				insertValueByPath(curDataRef.current, atPath, (ptr) => {
					Object.assign(ptr, data);
				});
			} else {
				Object.assign(curDataRef.current, data);
			}
		},
		onSubmit: defaultFormSubmitter,
		addSyntheticControl: (getter) => {
			const id = `${new Date().toISOString()}-${simcount++}`;
			synthetic[id] = getter;
			return id;
		},
		getSyntheticControlValue: (id) => synthetic[id]?.(),
		listenFor: (e, l) => {
			eventBus.addListener(e, l);
			return () => eventBus.removeListener(e, l);
		},
		emit,
		...p,
		addSubForm: (ele) => {
			if (ele) {
				subForms.push(ele);
				emit('hook-controls', ele);
			}
		},
		getSubForms: () => [...subForms],
	};
};

export const DynamicFormContext = createContext(makeDynFormContext());

export type DynamicFormProps = {
	action?: string;
	method?: string;
	encType?: string;
	// onSubmit?: DynamicFormSubmitter;
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
	afterSubmission,
	...props
}: DynamicFormProps) => {
	const ctx = useContext(DynamicFormContext);
	const ref = useRef<null | HTMLFormElement>(null);
	const curDataRef = useRef<FormData>(ctx.initialData);

	// even though ctx is created above, dynamicForm is charge of data state, so override context value here
	ctx.curDataRef.current = curDataRef.current;

	const detectChanges = (scope = '') => {
		// curDataRef.current is our canonical current state, but UI rendering may omit certain
		// fields from input control (e.g. id). so, in order to properly diff, we need to
		// clone curDataRef.current and use that as the starting point for collecting data
		const data = collectAllInputValues(
			ref.current as HTMLFormElement,
			ctx,
			{ dataRef: cloneObj(curDataRef.current), collectSubforms: true }
		);
		const diff = computeDiff(curDataRef.current, data);
		if (diff.hasDiff) {
			Object.assign(curDataRef.current, data);
			ctx.emit('control-update', { diff, scope });
		}
	};

	const listener: HookControlListener = (ename, ctrl, e) => {
		if (ename === 'blur') {
			detectChanges(getScope(ctrl));
		}
	};

	useEffect(() => {
		hookControlOnHandlers(ref.current, listener);
		collectAllInputValues(ref.current as HTMLFormElement, ctx, {
			dataRef: curDataRef.current,
			collectSubforms: true,
		});

		const unsubDetect = ctx.listenFor('detect-changes', () => {
			detectChanges();
		});

		const unsubSetInitial = ctx.listenFor(
			'set-initial-data',
			(e, initial) => {
				ctx.initialData = { ...initial };
				ctx.emit('detect-changes', {});
			}
		);

		const unsubHook = ctx.listenFor(
			'hook-controls',
			(e, ele: HTMLElement) => {
				hookControlOnHandlers(ele, listener);
			}
		);

		return () => {
			unsubDetect();
			unsubSetInitial();
			unsubHook();
		};
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
				ctx.emit('submit-start', data);
				ctx.onSubmit(data, props).then((response) => {
					ctx.emit('submit-end', { data, response });
				});
			}}
		>
			{children}
		</form>
	);
};
