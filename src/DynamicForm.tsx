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
export const SIMULATED_CONTROL_ATTRIBUTE = 'data-x-control';

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
	ctrl?.dataset['x-control'] !== undefined;

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
		'input, textarea, select, [' + SIMULATED_CONTROL_ATTRIBUTE + ']'
	).forEach((ele) => {
		const ctrl = ele as HTMLInputElement;
		const oldBlur = ctrl.onblur;
		ctrl.onblur = (e) => {
			oldBlur?.call(ctrl, e);
			listener('blur', ctrl, e);
		};
	});
};

export const collectAllInputValues = (
	form: HTMLFormElement,
	dataRef?: FormData
) => {
	const data: FormData = dataRef ?? {};
	let anonId = 0;
	// todo: query `[data-x-control]` for control-like objects
	form.querySelectorAll(
		'input, textarea, select, [' + SIMULATED_CONTROL_ATTRIBUTE + ']'
	).forEach((ele) => {
		const ctrl = ele as HTMLInputElement;
		// console.log('control: ', ctrl, ' data: ', data);
		const key = ctrl.name || `anonymous-${ctrl.type}-${anonId++}`;
		if (isMultiple(ctrl)) {
			if (ctrl instanceof HTMLSelectElement) {
				data[key] = [];
				for (const opt of ctrl.selectedOptions) {
					data[key].push(opt.value);
				}
			} else {
				if (ctrl.type === 'checkbox' && !ctrl.checked) {
					return;
				}

				if (data[key] === undefined) {
					data[key] = [ctrl.value];
				} else {
					data[key].push(ctrl.value);
				}
			}
		} else {
			if (ctrl.type === 'radio' && !ctrl.checked) {
				return;
			} else if (isSimulatedControl(ctrl)) {
				data[key] = ctrl.getValue();
			}

			data[key] = ctrl.value;
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

export const areObjectsSame = (oval: any, nval: any): boolean => {
	const okeys = Object.keys(oval);
	const nkeys = Object.keys(nval);
	if (okeys.length !== nkeys.length) {
		return false;
	}

	const allKeys: Record<string, boolean> = {};
	for (const okey of okeys) {
		if (!areValuesSame(oval[okey], nval[okey])) {
			return false;
		}
		allKeys[okey] = true;
	}

	for (const nkey of nkeys) {
		if (allKeys[nkey]) {
			continue;
		}
		// if we haven't examined nkey, that means it wasn't even in oval
		return false;
	}

	return true;
};

export const areValuesSame = (oval: any, nval: any): boolean => {
	// todo: support objects
	if (oval instanceof Array && nval instanceof Array) {
		return areArraysSame(oval, nval);
	} else if (typeof oval === 'object' && typeof nval === 'object') {
		return areObjectsSame(oval, nval);
	}

	return oval === nval;
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

export type DynamicFormContextProps = {
	controlUpdated?: (name: string, newVal: any, oldVal: any) => void;
};

export const DynamicFormContext = createContext({} as DynamicFormContextProps);

export type DynamicFormProps = {
	action?: string;
	method?: string;
	encType?: string;
	submitter?: DynamicFormSubmitter;
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
	submitter = defaultFormSubmitter,
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
			const data = collectAllInputValues(ref.current as HTMLFormElement);
			if (!areValuesSame(refData.current[key], data[key])) {
				ctx.controlUpdated?.(key, data[key], refData.current[key]);
				refData.current[key] = data[key];
			}
		}
	};

	useEffect(() => {
		collectAllInputValues(ref.current as HTMLFormElement, refData.current);
		hookControlOnHandlers(ref.current, listener);
		console.log('-> refData = ', refData.current);
	});

	return (
		<form
			{...props}
			ref={ref}
			onSubmit={(e) => {
				e.preventDefault();
				const data = collectAllInputValues(e.target as HTMLFormElement);
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
