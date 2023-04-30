/**
 * @jest-environment jsdom
 */
import React from 'react';
import { act, fireEvent, render, renderHook } from '@testing-library/react';
import { DynamicForm, ManagedInput, getInitialStateValue } from './DynamicForm';
import { MCheckbox, MSelect, MText } from './ManagedControls';

describe('frontend/components/DynamicForm', () => {
	describe('#getInitialStateValue', () => {
		test('gets scalar', () => {
			expect(getInitialStateValue('key', {})).toEqual(undefined);
			expect(getInitialStateValue('key', { key: 1 })).toEqual(1);
		});
		test('gets scalar from string/array', () => {
			// assert: no value
			expect(getInitialStateValue('key', {}, true)).toEqual(undefined);
			// assert: value is string but does not match ctrlValue
			expect(
				getInitialStateValue('key', { key: 'scalar' }, true)
			).toEqual(undefined);
			// assert: value is string and matches
			expect(
				getInitialStateValue('key', { key: 'scalar' }, true, 'scalar')
			).toEqual('scalar');
			// assert: value is array but ctrlValue not in it
			expect(
				getInitialStateValue('key', { key: [] }, true, 'scalar')
			).toEqual(undefined);
			// assert: value is array and ctrlValue in it
			expect(
				getInitialStateValue('key', { key: ['scalar'] }, true, 'scalar')
			).toEqual('scalar');
		});
	});

	describe('#getArrayValueHelper', () => {
		// todo:
	});

	describe('#getMultiSelectValueHelper', () => {
		// todo:
	});

	describe('<ManagedControl />', () => {
		const renderFormWithInputsHelper = (
			ctrl: JSX.Element | JSX.Element[],
			props: any = {},
			state?: any
		) => {
			const pings: [string, any, any][] = [];
			const control = render(
				<DynamicForm
					formId="x"
					ping={(a, s, d) => {
						pings.push([a, s, d]);
					}}
					initValues={state}
					saveFn={async (state) => {
						return {};
					}}
				>
					{ctrl}
				</DynamicForm>
			);
			// first event is always setting initial state
			pings.shift();
			const input = (id = 'ctrl') => {
				// console.log({ input: id });
				return control.getByTestId(id);
			};
			return {
				pings,
				control,
				input,
				setvalue: (value: string | string[], doBlur = true) => {
					fireEvent.click(input());
					fireEvent.change(input(), {
						target: { value },
					});
					if (doBlur) fireEvent.blur(input());
				},
				toggle: (testid?: string) => {
					// console.log({ toggle: testid });
					fireEvent.click(input(testid));
					fireEvent.blur(input(testid));
				},
				click: (testid = 'ctrl') => {
					fireEvent.click(input(testid));
				},
			};
		};

		test(`<MText /> propagates internal state onBlur`, async () => {
			const { pings, setvalue, input } = renderFormWithInputsHelper(
				<MText name="managed" data-testid="ctrl" />
			);

			await act(() => {
				setvalue('val');
			});

			const lastPing = pings.shift();

			expect(lastPing).toEqual([
				'beforeStateChange',
				{},
				{ managed: 'val' },
			]);

			// assert: no state change occurs since no net changes have happened
			fireEvent.click(input());
			fireEvent.blur(input());

			expect(pings.shift()).toBeUndefined();
		});

		test(`<MCheckbox /> (boolean) propagates internal state onBlur`, async () => {
			const { pings, toggle, control } = renderFormWithInputsHelper(
				<MCheckbox name="managed" data-testid="ctrl" />
			);
			act(() => {
				toggle();
				toggle();
			});
			expect(pings).toEqual([
				['beforeStateChange', {}, { managed: true }],
				[
					'beforeStateChange',
					{ managed: true },
					{ managed: undefined },
				],
			]);
		});

		test(`<MCheckbox /> (string) propagates internal state onBlur`, async () => {
			const { pings, toggle, control } = renderFormWithInputsHelper(
				<MCheckbox name="managed" data-testid="ctrl" value="a" />
			);
			act(() => {
				toggle();
				toggle();
			});
			expect(pings).toEqual([
				['beforeStateChange', {}, { managed: 'a' }],
				['beforeStateChange', { managed: 'a' }, { managed: undefined }],
			]);
		});

		test(`<MCheckbox />[] (string[]) accurately captures list`, () => {
			const { pings, toggle, control } = renderFormWithInputsHelper(
				[
					<MCheckbox
						name="managed"
						data-testid="ctrl"
						value="a"
						isArray
						key="a"
					/>,
					<MCheckbox
						name="managed"
						data-testid="ctrl1"
						value="b"
						isArray
						key="b"
					/>,
				],
				{
					isArray: true,
				}
			);
			act(() => {
				toggle();
				toggle('ctrl1');
				toggle('ctrl1');
			});

			expect(pings).toEqual([
				['beforeStateChange', {}, { managed: ['a'] }],
				[
					'beforeStateChange',
					{ managed: ['a'] },
					{ managed: ['a', 'b'] },
				],
				[
					'beforeStateChange',
					{ managed: ['a', 'b'] },
					{ managed: ['a'] },
				],
			]);
		});

		// @todo testing library doesn't support multiple values for onchange, so currently
		// incomplete
		test(`<MSelect multiple />`, () => {
			const { pings, input, setvalue } = renderFormWithInputsHelper(
				<MSelect name="managed" data-testid="ctrl" multiple>
					<option value="1" data-testid="opt1" key="1">
						o1
					</option>
					<option value="2" data-testid="opt2" key="2">
						o2
					</option>
					<option value="3" data-testid="opt3" key="3">
						o3
					</option>
				</MSelect>
			);
			act(() => {
				setvalue(['1']);
			});

			expect(pings).toEqual([
				['beforeStateChange', {}, { managed: ['1'] }],
			]);
		});
	});
});
