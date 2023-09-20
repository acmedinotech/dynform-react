import React from 'react';
import {
	DynamicForm,
	DynamicFormContext,
	ENCTYPE_JSON,
	makeDynFormContext,
} from '..';

export default function UserProfile() {
	const formCtx = makeDynFormContext({});
	return (
		<DynamicFormContext.Provider value={formCtx}>
			<DynamicForm
				action="/api/form-submit"
				encType={ENCTYPE_JSON}
				afterSubmission={async (resp, data) => {
					console.log('afterSubmission = ', await resp.json());
				}}
			>
				<b>first name</b>: <input type="text" name="firstName" />
				<br />
				<b>last name</b>: <input type="text" name="lastName" />
				<br />
				<fieldset data-dfr-scope="address">
					<legend>address</legend>
					<b>line 1</b>: <input type="text" name="line1" />
					<br />
					<b>line 2</b>: <input type="text" name="line2" />
					<br />
					<b>city</b>: <input type="text" name="city" />
					<br />
				</fieldset>
				<button type="submit">submit</button>
			</DynamicForm>
		</DynamicFormContext.Provider>
	);
}
