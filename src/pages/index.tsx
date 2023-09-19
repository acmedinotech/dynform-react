import React from 'react';
import {
	DynamicForm,
	DynamicFormContext,
	ENCTYPE_JSON,
	makeDynFormContext,
} from '..';

export default function Example() {
	const formCtx = makeDynFormContext({
		controlUpdated: (name, nv, ov) => {
			console.log('changed!', name, { new: nv, old: ov });
		},
	});
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
					<input type="text" name="sub_text" />
				</fieldset>
				<hr />
				<button type="submit">submit</button>
			</DynamicForm>
		</DynamicFormContext.Provider>
	);
}
