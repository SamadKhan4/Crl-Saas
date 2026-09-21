import { Controller, useFieldArray } from 'react-hook-form';
import { Plus, Trash2 } from 'lucide-react';

const serviceOptions = ['HUB_TO_HUB', 'DOOR_TO_DOOR', 'DOOR_TO_HUB', 'HUB_TO_DOOR', 'PTL', 'FTL', 'FM', 'MM', 'LM', 'PICKUP', 'DELIVERY', 'REVERSE'];

export function CustomerLocationsField({ control, register, name, label }) {
  const { fields, append, remove } = useFieldArray({ control, name });
  return <fieldset className="customer-repeat-field"><legend>{label}</legend>
    {fields.map((field, index) => <div className="customer-repeat-row" key={field.id}>
      <input aria-label={`${label} code ${index + 1}`} placeholder="Code" {...register(`${name}.${index}.code`)} />
      <input aria-label={`${label} name ${index + 1}`} placeholder="Location name" {...register(`${name}.${index}.name`)} />
      <input aria-label={`${label} address ${index + 1}`} placeholder="Address" {...register(`${name}.${index}.address`)} />
      <input aria-label={`${label} city ${index + 1}`} placeholder="City" {...register(`${name}.${index}.city`)} />
      <input aria-label={`${label} pincode ${index + 1}`} placeholder="Pincode" {...register(`${name}.${index}.pincode`)} />
      <input aria-label={`${label} contact ${index + 1}`} placeholder="Contact person" {...register(`${name}.${index}.contactPerson`)} />
      <input aria-label={`${label} mobile ${index + 1}`} placeholder="Mobile" {...register(`${name}.${index}.mobile`)} />
      <button type="button" className="icon-btn" aria-label={`Remove ${label} ${index + 1}`} onClick={() => remove(index)}><Trash2 size={16} /></button>
    </div>)}
    <button type="button" className="btn secondary" onClick={() => append({ code: '', name: '', address: '', city: '', state: '', pincode: '', contactPerson: '', mobile: '' })}><Plus size={16} /> Add location</button>
  </fieldset>;
}

export function CustomerServicesField({ control }) {
  return <Controller name="services" control={control} render={({ field }) => <fieldset className="customer-repeat-field"><legend>Enabled services</legend><div className="customer-service-grid">{serviceOptions.map((service) => <label key={service}><input type="checkbox" checked={(field.value || []).includes(service)} onChange={(event) => field.onChange(event.target.checked ? [...(field.value || []), service] : (field.value || []).filter((value) => value !== service))} /> {service.replaceAll('_', ' ')}</label>)}</div></fieldset>} />;
}

export function CustomerBillingField({ register }) {
  return <fieldset className="customer-repeat-field"><legend>Billing & credit control</legend><div className="form-grid">
    <label>Billing cycle<input {...register('billing.cycle')} placeholder="Weekly / fortnightly / monthly" /></label>
    <label>Payment terms<input {...register('billing.paymentTerms')} placeholder="15 / 30 days" /></label>
    <label>Credit limit<input type="number" min="0" {...register('billing.creditLimit')} /></label>
    <label>Credit days<input type="number" min="0" max="365" {...register('billing.creditDays')} /></label>
    <label>Invoice mode<select {...register('billing.invoiceMode')}><option value="">Select</option><option value="SINGLE_LR">Single LR</option><option value="CONSOLIDATED">Consolidated</option><option value="BOTH">Both</option></select></label>
    <label>Billing email<input type="email" {...register('billing.billingEmail')} /></label>
    <label>GST %<input type="number" min="0" max="100" {...register('billing.gstRate')} /></label>
    <label>TDS %<input type="number" min="0" max="100" {...register('billing.tdsRate')} /></label>
  </div></fieldset>;
}

export function CustomerContactsField({ control, register }) {
  const { fields, append, remove } = useFieldArray({ control, name: 'contacts' });
  return <fieldset className="customer-repeat-field"><legend>Contact persons</legend>{fields.map((field, index) => <div className="customer-repeat-row customer-contact-row" key={field.id}><select {...register(`contacts.${index}.department`)}><option>ACCOUNTS</option><option>OPERATIONS</option><option>LOGISTICS</option><option>MANAGEMENT</option><option>OTHER</option></select><input placeholder="Name" {...register(`contacts.${index}.name`)} /><input placeholder="Mobile" {...register(`contacts.${index}.mobile`)} /><input type="email" placeholder="Email" {...register(`contacts.${index}.email`)} /><button type="button" className="icon-btn" onClick={() => remove(index)}><Trash2 size={16} /></button></div>)}<button type="button" className="btn secondary" onClick={() => append({ department: 'ACCOUNTS', name: '', mobile: '', email: '' })}><Plus size={16} /> Add contact</button></fieldset>;
}
