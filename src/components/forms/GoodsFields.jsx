import { useEffect } from 'react';
import { useFieldArray, useWatch } from 'react-hook-form';
import { Plus, Trash2 } from 'lucide-react';
import { FormField } from '../common/UI';
import { calculateGoods } from '../../lib/goods';

export const emptyGoods = () => ({ description: '', packageNumber: '', packageType: '', quantity: 1, actualWeight: '', length: '', breadth: '', height: '', dimensionUnit: 'CM', declaredValue: '' });

export default function GoodsFields({ control, register, setValue, errors }) {
  const { fields, append, remove } = useFieldArray({ control, name: 'goods' });
  const goods = useWatch({ control, name: 'goods' });
  const totals = calculateGoods(goods);
  useEffect(() => {
    setValue('packageCount', totals.packageCount);
    setValue('weightKg', totals.actualWeight);
  }, [setValue, totals.packageCount, totals.actualWeight]);
  return <>
    <p>Dimensions are per package; actual weight is the total for that row. Leave all dimensions blank if unavailable. 1 CFT = 7 kg.</p>
    {fields.map((field, index) => <fieldset key={field.id} className="form-section" style={{ minWidth: 0, border: '1px solid var(--border, #ddd)', borderRadius: 12, padding: 16, marginTop: 16 }}>
      <legend>Goods {index + 1}</legend>
      <div className="form-grid">
        {[
          ['packageNumber', 'Pkg. No.'], ['description', 'Description of goods'], ['packageType', 'Package type'],
          ['quantity', 'Package quantity', 'number'], ['actualWeight', 'Actual weight for this row (kg)', 'number'],
          ['length', 'Length', 'number'], ['breadth', 'Breadth', 'number'], ['height', 'Height', 'number'],
          ['declaredValue', 'Declared value (Rs)', 'number'],
        ].map(([name, label, type = 'text']) => <FormField key={name} label={label} type={type}
          min={type === 'number' ? (name === 'quantity' ? 1 : 0) : undefined} step={name === 'quantity' ? '1' : 'any'}
          {...register(`goods.${index}.${name}`)} error={errors.goods?.[index]?.[name]?.message} />)}
        <div className="field">
          <label htmlFor={`goods-unit-${field.id}`}>Dimension unit</label>
          <select id={`goods-unit-${field.id}`} {...register(`goods.${index}.dimensionUnit`)}>
            <option value="CM">Centimetres (cm)</option><option value="IN">Inches</option><option value="FT">Feet</option>
          </select>
          <small className="field-error">{errors.goods?.[index]?.dimensionUnit?.message}</small>
        </div>
      </div>
      <div className="actions" style={{ marginTop: 12 }}>
        <span>CFT: {totals.goods[index]?.volume || 0} · Volumetric: {totals.goods[index]?.volumetricWeight || 0} kg</span>
        <button type="button" className="btn secondary" disabled={fields.length === 1} onClick={() => remove(index)} aria-label={`Remove goods ${index + 1}`}><Trash2 size={16} /> Remove</button>
      </div>
    </fieldset>)}
    <small className="field-error">{errors.goods?.message || errors.goods?.root?.message}</small>
    <button type="button" className="btn secondary" style={{ marginTop: 16 }} disabled={fields.length >= 100} onClick={() => append(emptyGoods())}><Plus size={16} /> Add goods</button>
    <div className="summary-grid" aria-live="polite" style={{ marginTop: 16 }}>
      <div><small>Total actual weight</small><strong>{totals.actualWeight} kg</strong></div>
      <div><small>Total volumetric weight</small><strong>{totals.volumetricWeight} kg</strong></div>
      <div><small>Chargeable weight for invoice</small><strong>{totals.chargedWeight} kg</strong></div>
    </div>
  </>;
}
