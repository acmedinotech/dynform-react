import React from 'react';
import {
	DynamicForm,
	DynamicFormContext,
	ENCTYPE_JSON,
	makeDynFormContext,
} from '..';

export default function Example() {
	const formCtx = makeDynFormContext({
		controlUpdated: (diff) => {
			console.log('changed!', diff.diffs);
		},
	});

	const sid = formCtx.addSimulatedControl(() => {
		return {
			name: 'simulated',
			value: 'simulated!',
		};
	});

	const indexedRecords = [{ id: 1 }, { id: 2 }];

	return (
		<DynamicFormContext.Provider value={formCtx}>
			<DynamicForm
				action="/api/form-submit"
				encType={ENCTYPE_JSON}
				afterSubmission={async (resp, data) => {
					console.log('afterSubmission = ', await resp.json());
				}}
			>
				<input name="text" type="text" defaultValue={'default-text'} />
				<br />
				multi:{' '}
				<input
					name="text-multi"
					type="text"
					defaultValue={'default-text1'}
					multiple={true}
				/>
				<br />x multi:{' '}
				<input
					name="text-multi"
					type="text"
					defaultValue={'default-text2'}
					multiple={true}
				/>
				<br />
				<select name="select">
					<option value="1">one</option>
					<option value="2">two</option>
				</select>
				<br />
				<select name="select-multi" multiple={true}>
					<option value="1">one</option>
					<option value="2">two</option>
					<option value="3">three</option>
				</select>
				<br />
				<input
					type="checkbox"
					name="checkbox"
					defaultChecked={true}
					value="c1"
				/>
				<input type="checkbox" name="checkbox" value="c2" />
				<br />
				<input type="radio" name="radio" value="r1" />
				<input type="radio" name="radio" value="r2" />
				<hr />
				<fieldset data-dfr-scope="sub">
					scoped to <code>sub</code>:{' '}
					<input type="text" name="sub_text" />
				</fieldset>
				<hr />
				{indexedRecords.map((rec, i) => (
					<fieldset data-dfr-scope={`indexedRecord[${i}]`}>
						record:{' '}
						<input type="text" name="id" defaultValue={rec.id} />
					</fieldset>
				))}
				<hr />
				<div data-dfr-control={sid}>placeholder for simulated data</div>
				<hr />
				<button type="submit">submit</button>
			</DynamicForm>
		</DynamicFormContext.Provider>
	);
}
