import React, { PropsWithChildren, useEffect, useRef } from 'react';

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

export const hookBlurs = (
	form: null | HTMLFormElement,
	listener: (ctrl: HTMLElement, e: FocusEvent) => void
) => {
	if (!form) {
		return;
	}

	form.querySelectorAll(
		'input, textarea, select, [' + SIMULATED_CONTROL_ATTRIBUTE + ']'
	).forEach((ele) => {
		const ctrl = ele as HTMLInputElement;
		const oldBlur = ctrl.onblur;
		ctrl.onblur = (e) => {
			listener(ctrl, e);
			oldBlur?.call(ctrl, e);
		};
	});
};

export const collectAllInputValues = (form: HTMLFormElement) => {
	const data: FormData = {};
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

export type DynamicFormSubmitter = (
	data: FormData,
	config: DynamicFormProps
) => Promise<Response>;

export type DynamicFormProps = {
	action?: string;
	method?: string;
	encType?: string;
	submitter?: DynamicFormSubmitter;
} & PropsWithChildren;

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
 * An extension to native `<form/>` that is enhanced through:
 *
 * - easy support of JSON submissions
 * - notification of control changes through onBlur() detection and state comparison
 */
export const DynamicForm = ({
	children,
	submitter = defaultFormSubmitter,
	...props
}: DynamicFormProps) => {
	const ref = useRef<null | HTMLFormElement>(null);
	const refData = useRef<FormData>({});

	useEffect(() => {
		hookBlurs(ref.current, (ctrl, e) => {
			console.log('blurred: ', ctrl, e);
		});
		console.log('form.ref = ', ref);
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
					console.log(resp);
				});
			}}
		>
			{children}
		</form>
	);
};
