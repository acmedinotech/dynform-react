import React, {
	FunctionComponent,
	SyntheticEvent,
	cloneElement,
	createContext,
	useContext,
	useEffect,
	useState,
} from 'react';

export type FormStatus<Payload = any> = {
	status?: 'ok' | 'err' | 'dirty';
	errors?: any;
	payload?: Payload;
};

export type FormChangePingFn<State = any> = (
	action: 'beforeStateChange' | 'beforeReset' | 'beforeCancel' | 'formBlur',
	curState: State,
	payload?: any
) => void;

export type FormStatusFn<State = any> = (status: FormStatus<State>) => void;

export type DynamicFormProps = {
	className?: string;
	children?: JSX.Element | JSX.Element[];
	mode?: string | 'add' | 'edit';
	formId?: string;
	initValues?: any;
	// fields: { name: string; control: JSX.Element; disabled?: boolean }[];
	saveFn: (values: any) => Promise<FormStatus>;
	resetFn?: () => void;
	cancelFn?: () => void;
	ping?: FormChangePingFn;
	/**
	 * Triggered in useEffect() if state is defined. Use this in conjunction with
	 * `formStatus.status === 'dirty'` to auto-save after a state change.
	 */
	afterLoad?: (
		values: any,
		curStatus: FormStatus,
		statusFn: FormStatusFn
	) => void;
};

/**
 * Object that exposes lifecycle hooks for a form.
 *
 * ## Note on `ping` vs `resetFn`/`cancelFn`
 *
 * The reset/cancel functions are guaranteed to exist, and will do two things:
 *
 * 1. call `ping` with appropriate event name
 * 2. execute caller-supplied function if it's defined
 *
 * Emitting `ping()` allows us to make generic form buttons that can
 * indirectly trigger the intended actions through optional function handlers.
 */
export type DynamicFormContextManager<State = any> = {
	mode?: string | 'add' | 'edit';
	formId: string;
	parent?: DynamicFormContextManager;
	allDisabled?: boolean;
	initValues: Partial<State>;
	state: State;
	formStatus: FormStatus<State>;
	/**
	 * Notifies a listener before a state change is triggered.
	 */
	ping: FormChangePingFn<State>;
	/**
	 * Merges given state with existing state. Calling this will also change status
	 * in the following ways:
	 *
	 * - if either previous state or new state is `undefined`, status is blanked out
	 * - otherwise, status is set to `dirty`
	 * @param state
	 * @returns
	 */
	setState: (state: Partial<State>) => void;
	// hasFieldChangedSinceSave: (name: string) => boolean;
	/**
	 * Sets form status to either `err` or non-error state.
	 */
	setFormStatus: FormStatusFn<State>;
	/**
	 * Communicates status of a child form. If 1+ child statuses has an error,
	 * it prevents saveFn() from executing.
	 * @param id
	 * @param status
	 * @returns
	 */
	childStatusChange: (
		id: string,
		status: DynamicFormContextManager['formStatus']
	) => void;
	saveFn: (model: State) => Promise<FormStatus<State>>;
	resetFn: () => void;
	cancelFn: () => void;
};

export const DynamicFormContext = createContext(
	undefined as any as DynamicFormContextManager
);

export const shallowCompareObj = (m1: any, m2: any) => {
	const examined: any = {};
	const failed: string[] = [];
	const keys = [...Object.keys(m1), ...Object.keys(m2)].filter((k) => {
		if (examined[k]) {
			return false;
		}
		examined[k] = true;
		return true;
	});
	for (const key of keys) {
		if (m1[key] !== m2[key]) {
			failed.push(key);
		}
	}
	return failed.length === 0 ? undefined : failed;
};

export const removeUndefinedFromObj = (obj: any): any => {
	const newObj: any = {};
	for (const [k, v] of Object.entries(obj)) {
		if (v !== undefined) {
			newObj[k] = v;
		}
	}

	return newObj;
};

let formCount = 0;

/**
 * Prepares a form context that can be passed to contextProvider value.
 * State is managed within this hook. The parent context, if it exists,
 * is notified of changes.
 */
export function useDynamicFormContext<State = any>(
	p: Partial<DynamicFormProps>
): DynamicFormContextManager<State> {
	const parent = useContext(DynamicFormContext);
	const [{ state, formStatus, refreshCount }, setForm] = useState<{
		state: State;
		formStatus: FormStatus<State>;
		refreshCount: number;
	}>({
		state: p.initValues,
		formStatus: {},
		refreshCount: 0,
	});
	const setState = (s: State) => {
		setForm({
			state: s,
			formStatus,
			refreshCount,
		});
	};
	const setFormStatus = (f: FormStatus) => {
		setForm({
			state,
			formStatus: f,
			refreshCount,
		});
	};

	const children: Record<string, DynamicFormContextManager['formStatus']> =
		{};
	useEffect(() => {
		return () => {
			//
		};
	});

	const childStatusChange = (
		id: string,
		status: DynamicFormContextManager['formStatus']
	) => {
		children[id] = status;
	};
	const ping =
		p.ping ?? (((a, s, d) => {}) as DynamicFormContextManager['ping']);

	const saveFn =
		p.saveFn ??
		(async (s) => {
			return { status: 'ok' };
		});
	const ctx: DynamicFormContextManager = {
		parent,
		formId: `${p.formId}:${refreshCount}`,
		mode: p.mode,
		allDisabled: false,
		initValues: p.initValues,
		state,
		formStatus,
		ping,
		childStatusChange,
		setState: (s) => {
			parent?.childStatusChange(ctx.formId, { status: 'dirty' });
			ping('beforeStateChange', state, s);
			setState(
				s === undefined
					? s
					: removeUndefinedFromObj({ ...(state ?? {}), ...s })
			);

			const nextStatus =
				s === undefined || state === undefined ? undefined : 'dirty';

			setForm({
				state:
					s === undefined
						? s
						: removeUndefinedFromObj({ ...(state ?? {}), ...s }),
				formStatus: { status: nextStatus },
				refreshCount,
			});
		},
		setFormStatus: (f) => {
			parent?.childStatusChange(ctx.formId, f);
			setForm({
				state: f.payload ?? state,
				formStatus: f,
				refreshCount,
			});
		},
		saveFn:
			p.saveFn !== undefined
				? async (s) => {
						for (const childId in children) {
							if (children[childId].status === 'err') {
								return {
									status: 'err',
									errors: {
										message:
											'1 or more fields have bad data.',
									},
								};
							}
						}
						const ret = await saveFn(s);
						return ret;
				  }
				: saveFn,
		// hasFieldChangedSinceSave: (name) => {
		// 	const prevVal = (formStatus.payload ?? p.initValues ?? {})[name];
		// 	return prevVal !== state[name];
		// },
		resetFn: () => {
			ping('beforeReset', state);
			setForm({
				state: p.initValues as any,
				formStatus: {},
				refreshCount: refreshCount + 1,
			});
		},
		cancelFn: () => {
			ping('beforeCancel', state, p.cancelFn);
			p.cancelFn?.();
		},
	};

	return ctx;
}

export type DynamicFormButtonTrayProps = {};

export const DefaultButtonTray = () => {
	const ctx = useContext(DynamicFormContext);
	const { allDisabled, saveFn, state, setFormStatus, resetFn, cancelFn } =
		ctx;
	return (
		<>
			<button
				disabled={allDisabled}
				onClick={async () => {
					const ret = await saveFn(state);
					if (ret.status === 'err') {
						console.error('while saving form', ret.errors);
					}
					setFormStatus(ret);
				}}
			>
				save
			</button>
			<button disabled={allDisabled} onClick={resetFn}>
				reset
			</button>
			{cancelFn && (
				<button
					disabled={allDisabled}
					onClick={() => {
						cancelFn();
					}}
				>
					cancel
				</button>
			)}
		</>
	);
};

export const FormStatusRow = ({ errors, status }: FormStatus) => {
	if (!status) {
		return null;
	}

	if (status === 'ok') {
		return (
			<tr>
				<td colSpan={2} className={`status-ok`}>
					<b>successfully saved</b>
				</td>
			</tr>
		);
	} else {
		return (
			<tr>
				<td colSpan={2} className={`status-err`}>
					{errors?.message ?? errors?._errMap?.['*'] ?? ''}
				</td>
			</tr>
		);
	}
};

export type ValueHelperFactory = (
	/** Current props for managed control. */
	props: ManagedControlProps,
	/** Current local state value. */
	val: any,
	/** Parent form state value. */
	state: Record<string, any>
) => ValueHelper;

export type ManagedControlProps = {
	[key: string]: any;
	/**
	 * Overrides the key that will be used to update state, otherwise, taken from control's
	 * `name` attribute.
	 */
	name?: string;
	control: JSX.Element;
	children?: JSX.Element | JSX.Element[];
	disabled?: boolean;
	/**
	 * When a toggle control is no longer checked, this value is used to communicate not checked.
	 * Defaults to `undefined` (which erases key-value before save).
	 */
	toggleFalse?: false;
	/**
	 * Uses the array valueHelper if set. Ensure that this is only used for checkbox/radio/select,
	 * as
	 */
	isArray?: boolean;
	/**
	 * An object factory that handles initializing/checking/saving control value.
	 * The managed control already has helpers for basic scalars and basic arrays --
	 * define this for more advanced data transformations.
	 */
	valueHelperFactory?: ValueHelperFactory;
	/**
	 * Allows injecting additional props to the cloned input -- for instance, if
	 * wrapping an MUI field, you could pass error/helperText whenever there's an
	 * error on the current field.
	 * @param ctx
	 * @param name
	 * @returns
	 */
	propsInjector?: (ctx: DynamicFormContextManager, name: string) => any;
	/**
	 * Additionally formats value before it's set on input. Use it to enforce auto
	 * formatting, length restrictions, etc.
	 * @param value
	 * @returns
	 */
	formatValue?: (value: any) => string;
};

export type MinimalManagedControlProps = Omit<
	ManagedControlProps,
	'control'
> & { control?: JSX.Element };

/**
 * Determines the starting state value for a brand new control using the following semantics:
 *
 * - if scalar, return `state[name]`
 * - else:
 *   - if `state[name] === ctrlValue || state[name].indexOf(ctrlValue) != -1`, return `ctrlVal`
 * - otherwise, return `undefined`
 */
export const getInitialStateValue = (
	name: string,
	state: any,
	isArray?: boolean,
	ctrlValue?: string
) => {
	if (isArray) {
		const sv = state[name];
		if (sv === undefined) {
			return undefined;
		}
		if (!(sv instanceof Array)) {
			return sv === ctrlValue ? sv : undefined;
		}

		return sv.includes(ctrlValue) ? ctrlValue : undefined;
	} else {
		return state[name];
	}
};

/**
 * An object that facilitates transformation of state values to control value within a
 * <ManagedControl />. Each component can have its semantics for how this is used, so
 * check specific component docs for contextual usage.
 */
export type ValueHelper = {
	/** The name of the control. */
	name: string;
	/**
	 * Reflects either current local state value or the control element's `value` attribute.
	 * Can be used to set the rendered control's final `value` attribute and as a comparison
	 * against the parent state value.
	 *
	 * > In the case of `<select multiple/>`, values will be inferred from `<option selected/>`
	 */
	initVal: any;
	/** Indicates if this is a checkbox/radio/select-type */
	isToggleCtrl: boolean;
	/** Indicates if this is a multi-valued type */
	isArray?: boolean;
	/** For toggle controls, indicates if this is currently checked */
	isChecked: boolean;
	/**
	 * Extracts the value from the control when onChange occurs.
	 */
	valFromEvent: (evt: any) => any;
	/**
	 * Checks if the current value is different from parent state.
	 */
	shouldStateChange: () => boolean;
	/**
	 * Returns the value that will be saved to state.
	 */
	getStateVal: () => any;
};

/**
 * @param props
 * @param val The current local state value of control
 * @param state The parent state before control's changes have persisted
 * @returns
 */
export const getSingleValueHelper = (
	props: ManagedControlProps,
	val: any,
	state: any
): ValueHelper => {
	const { control, toggleFalse } = props;
	const name = props.name ?? control.props.name;
	const isToggleCtrl = !!control.props.type?.match(/checkbox|radio/);
	const isChecked =
		(val !== undefined && control.props.value === val) || !!val;
	const initVal = val ?? control.props.value ?? '';

	/**
	 * if control is not toggle, return string. otherwise:
	 * - if control is checked, return non-empty string from props or boolean:true
	 * - otherwise, return undefined
	 */
	const valFromEvent = (evt: any) => {
		if (isToggleCtrl) {
			if (evt.target.checked) {
				return initVal ? initVal : true;
			} else {
				return toggleFalse;
			}
		} else {
			return evt.target.value;
		}
	};

	return {
		name,
		isToggleCtrl,
		isChecked,
		initVal,
		valFromEvent,
		shouldStateChange: () => {
			return val !== state[name] || val !== initVal;
		},
		getStateVal: () => val,
	};
};

/**
 * Only applies to: checkbox; radio; select[multiple]
 *
 * - all controls expected to have 'value' set
 * - a control is initially selected if its value exists in `state[name]`
 * - a control is changed if current selection doesn't match initial
 * 
 * @param props
 * @param val The current local state value of control
 * @param state The parent state before control's changes have persisted
 * @returns

 */
export const getArrayValueHelper = (
	props: ManagedControlProps,
	val: any,
	state: any,
	opts?: {
		initValFn?: (control: JSX.Element, val: any) => any;
	}
): ValueHelper => {
	const { control, toggleFalse } = props;
	const name = props.name ?? control.props.name;
	const stateVal = (state[name] ?? []) as string[];
	const initVal = opts?.initValFn?.(control, val) ?? control.props.value;
	const isChecked = val !== undefined;

	const valFromEvent = (evt: any) => {
		if (evt.target.checked) {
			return initVal;
		} else {
			return toggleFalse;
		}
	};

	return {
		name,
		isToggleCtrl: true,
		isChecked,
		initVal,
		valFromEvent,
		shouldStateChange: () => {
			const needle = stateVal.find((v) => v == initVal);
			return (needle && !isChecked) || (!needle && isChecked);
		},
		getStateVal: () => {
			// always remove existing value to avoid dupes, and push value if selected
			const norm = stateVal.filter((v) => v !== initVal);
			if (isChecked) {
				norm.push(initVal);
			}
			return norm;
		},
	};
};

/**
 * An extension of `getArrayValueHelper` that deals with `<select multiple />` nuances.
 * @param props
 * @param val
 * @param state
 * @returns
 */
export const getMultiSelectValueHelper = (
	props: ManagedControlProps,
	val: any,
	state: any
): ValueHelper => {
	const vh = getArrayValueHelper(props, val, state, {
		initValFn: (ctrl, val) => {
			const selected: string[] = [];
			for (const opt of (ctrl.props.children ?? []) as JSX.Element[]) {
				if (opt.props.selected) {
					selected.push(opt.props.value);
				}
			}

			return selected.length > 0 ? selected.sort() : undefined;
		},
	});

	return {
		...vh,
		valFromEvent: (evt: any) => {
			const vals: string[] = [];
			for (const opts of evt.target
				.selectedOptions as HTMLOptionElement[]) {
				if (opts.selected) {
					vals.push(opts.value);
				}
			}

			return vals.sort();
		},
		shouldStateChange: () => {
			return val.join(',') !== (state[vh.name] ?? []).join(',');
		},
		getStateVal: () => {
			return val;
		},
	};
};

export const getValueHelper: ValueHelperFactory = (props, val, state) => {
	if (props.valueHelperFactory) {
		return props.valueHelperFactory(props, val, state);
	}

	const ctrl = props.control;
	if (ctrl.type === 'select' && ctrl.props.multiple) {
		return getMultiSelectValueHelper(props, val, state);
	}

	return props.isArray
		? getArrayValueHelper(props, val, state)
		: getSingleValueHelper(props, val, state);
};

export class ManagedControlException extends Error {}

/**
 * Given a input-like JSX.Element, hiijack some props so that the control's changes are
 * automatically communicated back to the parent form state. This component supports composition,
 * and chooses the input based on the following:
 *
 * 1. wraps exactly one child component -- if valid child not found,
 * 2. falls back to `props.control`;
 * 3. throws `ManagedControlException` if final control is undefined
 *
 * The following events are overridden:
 *
 * - `onChange`: updates local control state
 * - `onBlur`: propagates field change up to parent form state
 *
 * ## `ValueHelper`
 *
 * Once the initial state is set, a valueHelper is used to manage the lifecycle of the
 * component. The `initVal` sets control's rendered `value`, with the other methods used
 * to determine new value/state change/state value. Scalar/array values are automatically
 * handled.
 *
 * @throws `ManagedControlException` if `children.length > 1` or `control` not given as fallback
 */
export const ManagedControl = ({
	isArray,
	propsInjector,
	formatValue = (v: any) => v,
	...oprops
}: MinimalManagedControlProps) => {
	const { name: nameOverride, disabled, toggleFalse } = oprops;
	const control =
		oprops.children instanceof Array
			? undefined
			: oprops.children ?? oprops.control;
	if (!control) {
		throw new ManagedControlException(
			`must define 'control' or supply 1 child`
		);
	}

	const props = { ...oprops, control };
	const name = nameOverride ?? control.props.name;

	const ctx = useContext(DynamicFormContext);
	const { state, formStatus } = ctx;
	const [val, setVal] = useState<undefined | boolean | string>(
		getInitialStateValue(name, state, isArray, props.control.props.value)
	);

	const valHelper = getValueHelper({ ...props, isArray }, val, state);

	return React.cloneElement(control, {
		value: formatValue(val ?? valHelper.initVal),
		checked: valHelper.isChecked,
		...(propsInjector?.(ctx, name) ?? {}),
		onChange: (evt: any) => {
			const nval = valHelper.valFromEvent(evt);
			setVal(formatValue(nval));
		},
		onBlur: () => {
			if (valHelper.shouldStateChange()) {
				ctx.setState({ [name]: valHelper.getStateVal() });
			}
		},
	});
};

/**
 * Wraps given form input component with `<ManagedControl />` to auto-wire form behaviors:
 *
 * ```typescript
 * const Input = manage((props: any) => {
 *	return <input {...props} />;
 * });
 * ```
 */
export function manage<Props = any>(
	Component: FunctionComponent<Props>,
	p: Partial<ManagedControlProps> = {}
): FunctionComponent<Props> {
	const WrappedControl = (props: any) => {
		const control = <Component {...props} />;
		return <ManagedControl {...p} control={control} />;
	};
	return WrappedControl;
}

export const ManagedInput = manage(({ isArray, ...props }: any) => {
	const control = <input {...props} />;
	return <ManagedControl {...props} control={control} isArray={isArray} />;
});

export const ManagedTextarea = manage((props: any) => {
	return <textarea {...props} />;
});

export const ManagedSelect = manage((props: any) => {
	return <select {...props} />;
});

export const FormControlRow = (props: {
	name: string;
	control: JSX.Element;
	disabled?: boolean;
}) => {
	const ctx = useContext(DynamicFormContext);
	const {
		formStatus: { errors },
	} = ctx;
	const errMap = errors?._errMap ?? {};
	const p: any = {};
	if (props.control.type === 'select' && props.control.props.multiple) {
		p.isArray = true;
	}

	return (
		<React.Fragment>
			<tr>
				<td>{props.name}</td>
				<td>
					<ManagedControl {...props} {...p} />
				</td>
			</tr>
			{errMap[props.name] && (
				<tr>
					<td></td>
					<td style={{ color: 'red' }}>{errMap[props.name]}</td>
				</tr>
			)}
		</React.Fragment>
	);
};

/**
 * Very basic form wrapper that sets up the context for its children.
 */
export const DynamicForm = ({
	className,
	mode,
	formId,
	initValues,
	saveFn,
	cancelFn,
	afterLoad,
	...props
}: DynamicFormProps) => {
	const ctx = useDynamicFormContext({
		mode,
		formId,
		initValues,
		saveFn,
		cancelFn,
		...props,
	});

	useEffect(() => {
		if (ctx.state !== undefined) {
			afterLoad?.(ctx.state, ctx.formStatus, ctx.setFormStatus);
			return;
		}
		ctx.setState(initValues ?? {});
	});

	if (ctx.state === undefined) {
		return null;
	}

	// key ensures states are wiped out on reset
	return (
		<DynamicFormContext.Provider value={ctx} key={ctx.formId}>
			{props.children}
		</DynamicFormContext.Provider>
	);
};

/**
 * Very basic form wrapper that renders a 2-column table for given children.
 */
export type DynamicFormTableProps = DynamicFormProps & {
	className?: string;
	fields: { name: string; control: JSX.Element }[];
	hideStatus?: boolean;
	ButtonTray?: null | ((props: DynamicFormButtonTrayProps) => JSX.Element);
};

export const DynamicFormTable = (props: DynamicFormTableProps) => {
	const Table = () => {
		const ctx = useContext(DynamicFormContext);
		const Buttons = props.ButtonTray ?? DefaultButtonTray;
		return (
			<table className={`general-form ${props.className}`}>
				{!props.hideStatus && <FormStatusRow {...ctx.formStatus} />}
				{props.fields.map((ctrl, i) => {
					return <FormControlRow {...ctrl} key={i} />;
				})}
				<tr>
					<td colSpan={2}>
						<Buttons />
					</td>
				</tr>
			</table>
		);
	};

	return (
		<DynamicForm {...props}>
			<Table />
		</DynamicForm>
	);
};
