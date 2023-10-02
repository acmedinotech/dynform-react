# Dynamic Form for React (`dynform-react`)

_dynform-react_ (aka **dfr**) is an attempt to make working with form inputs easy. It uses a form-first approach, so that you can use `<form/>` and its inputs as-is and peel back the layers to enable further customizations.

## Example: Complex Data using  `data-dfr-scope`

Let's say you have a component to display a basic user record:

```typescript
// context initialization
const formCtx = makeDynFormContext({
  initialData: {
    firstName: '',
    address: {
      line1: '',
      line2: '',
      city: ''
    }
  }
})

// form structure
return <DynamicFormContext.Provider value={formCtx}>
  <form>
    <input type='text' name='firstName'>
    <fieldset data-dfr-scope='address'>
      <input type='text' name='line1'>
      <input type='text' name='line2'>
      <input type='text' name='city'>
    </fieldset>
  </form>
</DynamicFormContext.Provider>
```

TBD
