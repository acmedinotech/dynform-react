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

export const MTextarea = ({ value, ...props }: MinimalManagedControlProps) => {
	return (
		<ManagedControl {...props}>
			<textarea value={value} />
		</ManagedControl>
	);
};

export const MCheckbox = ({
	isArray,
	value,
	...props
}: MinimalManagedControlProps) => {
	return (
		<ManagedControl isArray={isArray} {...props}>
			<input type="checkbox" value={value} />
		</ManagedControl>
	);
};

export const MRadio = ({ value, ...props }: MinimalManagedControlProps) => {
	return (
		<ManagedControl {...props}>
			<input type="radio" value={value} />
		</ManagedControl>
	);
};

export const MSelect = ({
	value,
	multiple,
	children,
	...props
}: MinimalManagedControlProps) => {
	return (
		<ManagedControl {...props}>
			<select multiple={multiple}>{children}</select>
		</ManagedControl>
	);
};
