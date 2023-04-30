# Dynamic Form for React (`dynform-react`)

_dynform-react_ (aka **dfr**) attempts to accomplish the following:

- effecient rendering of forms by only updating the parent state when controls lose focus
- convenient hooks and contexts that allow arbitrary control of the parent form
- transparent management of embedded forms

## First, a Quick Demo

```jsx
import { DynamicForm, DynamicFormContext, ManagedControl } from '@acmedinotech/dynform-react';

const MyForm = (props:any) => {
  const SaveButton = () => {
    const formCtx = useContext(DynamicFormContext);
    return <button onClick={() => {
      formContext.saveFn();
    }}>save</button>
  }

  console.log({formStatus: formCtx.formStatus})

  return <DynamicForm
    formId="test"
    saveFn={async (data: any) => {
      console.log({saveFn: data});
      return {status: 'ok' /* or 'err' */, errors: {}}
    }}
    ping={(action, curState, diff) => {
      console.log({action, curState, diff});
    }}
    >
    First Name: <ManagedControl><input type="text" name="firstName" placeholder="First Name" /></ManagedControl> <br />
    <SaveButton />
  </DynamicForm>
}
```

When this form renders, changing firstName won't trigger any events. If you click away from it, however, you should expect to see:

```js
{ formStatus: { status: '' }}
{ action: "beforeStateChange", curState: {}, diff: { firstName: "Your Value" }}
{ formStatus: { status: 'dirty' }}
```

When you click **save**, you should expect to see:

```js
{ saveFn: { firstName: "Your Value" } }
{ formStatus: { status: 'ok' }}
```

With very little effort, you immediately have access to dynamic form capabilities that follow React state conventions.

## Efficient Rendering

Using basic React state management approaches, each control will update the entire state whenever `onChange` is triggered. For complex forms, this will result in a slower UI (and require you to save your control focus/cursor position). The ideal approach is to update the control on-change, and when a user is done with it, update the parent state.

dfr solves this in two ways:

1. `<DynamicForm/>` sets up a `DynamicFormContext` for its component tree
2. individual controls wrapped with `<ManagedControl/>` have their `onChange` and `onBlur` hijaacked:
   - `onChange` updates control-specific state
   - `onBlur` takes the current control state and triggers form update via context 

## Convenient Hooks and Contexts

The `DynamicFormContext` provides the ability to change form state for whatever form a component is embedded in, and allows observation of upcoming changes. This saves you a considerable amount of overhead in wiring up this flow yourself.



---

A set of components and helpers to handling form interactions.

The `<DynamicForm />` accepts a set of controls, which can include other forms:

```jsx
<DynamicForm fields={[
    {
        name: 'firstName',
        control: <input type='text' />
    },
    {
        name: 'address',
        control: <DynamicForm fields={[
            {
                name: 'line1',
                control: <input type='text' />
            }
        ]}>
    }
]}>
```

A control's `onChange` handler is hijacked -- to preprocess a value before the form deals with it, set `getControlValue(event) => any`, otherwise the control's `value` or `checked` state will be used.

> If you're supplying an embedded form, a different mechanism is used to communicate changes, which is described in the context section.

## Lifecycle Extensions

Forms accept an async `saveFn(state)` which is given the form's current state and is expected to return a `FormStatus` object reflecting whether or not save succeeded.

Forms also accept a `ping(action,curState,change)` which is called before a form state change.

## Status

Indicates the general health of the form with `status` as `err` (error), `dirty` (unsaved), or `ok` (default). Additional keys are supported:

- `errors`: for `status:'err'`, this object is expected to have a string `message` or `_errMap` with list of field names/messages
- `payload`: for `status:'ok'`, this object should hold the most current version of the state (i.e. after saving to a server, set this as the saved value)

Status changes are expected to occur when a control changes, when the form is validated, and when a save completes.

## Value Resolution

In order to capture the most current control value, the effective value is taken to be `state[controlId] ?? formStatus?.payload?.[controlId] ?? initialValue?.[controlId]`, meaning:

- the most current state value
- the most current value from `formStatus.status == 'ok'`
- the initial value provided on component init

## General Form Context Manager

The general form context manager (formCtx for short) exposes form data and various state operations that embedded controls can leverage for advanced changes. When state changes occur here, they change the state of the providing DynamicForm. `<DynamicForm />`s can be embedded, and a dependency is built between the child context and parent so that whenever a child's status changes, the parent is notified. We'll come back to this again.

### `setState` and `ping`

Partial changes can be persisted through `setState`:

```js
const formCtx = useContext(DynamicFormContextManager);
// ...
formCtx.setState({oldField: 'newValue'});
```

The `DynamicForm` can receive a `ping` function that, if defined, is called within `setState` before the change is persisted:

```jsx
<DynamicForm ping={(action, curState, change) => {
    console.log('state is gonna change!', action, {curState, change});
}} />
```

This allows the caller to take additional steps in response, such as a nested control refreshing its own state before the parent form re-renders.

### `setFormStatus`

Marks the form `status` as `err` (error), `dirty` (unsaved), or `ok` (default). Additional keys are supported:

- `errors`: for `status:'err'`, this object is expected to have a string `message` or `_errMap` with list of field names/messages
- `payload`: for `status:'ok'`, this object should hold the most current version of the state (i.e. after saving to a server, set this as the saved value)

### `saveFn`

Triggers the save handler of the caller. It's expected to return a formStatus object, which will trigger `setFormStatus`.

### Form Data Flow

- ℹ️ `state = initialState ?? {}`
- ℹ️ `formStatus = {}`
- onChange: 🔔 `ping`, 🔄 `setState`
- onBlur: if changes have occurred, 🔔 `saveFn`, 🔄 `setFormStatus`
  - ℹ️ `formStatus = {status: 'ok' or 'err'}`
