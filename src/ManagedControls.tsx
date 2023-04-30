import React, { cloneElement, useContext } from 'react';
import {
	DynamicFormContext,
	ManagedControl,
	MinimalManagedControlProps,
} from './DynamicForm';

export const MText = (props: MinimalManagedControlProps) => {
	return (
		<ManagedControl {...props}>
			<input type="text" {...props} />
		</ManagedControl>
	);
};

export const MTextarea = (props: MinimalManagedControlProps) => {
	return (
		<ManagedControl {...props}>
			<textarea />
		</ManagedControl>
	);
};

export const MCheckbox = ({
	isArray,
	...props
}: MinimalManagedControlProps) => {
	return (
		<ManagedControl isArray={isArray} {...props}>
			<input type="checkbox" />
		</ManagedControl>
	);
};

export const MRadio = (props: MinimalManagedControlProps) => {
	return (
		<ManagedControl {...props}>
			<input type="radio" />
		</ManagedControl>
	);
};

export const MSelect = (props: MinimalManagedControlProps) => {
	return (
		<ManagedControl {...props}>
			<select />
		</ManagedControl>
	);
};
