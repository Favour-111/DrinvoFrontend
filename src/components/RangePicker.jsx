import { useState } from 'react';
import { Field } from './ui/Form.jsx';
import { isoDate } from '../utils/format.js';

export function useRange(initial = '7d') {
  const [range, setRange] = useState(initial);
  const [custom, setCustom] = useState({ from: isoDate(new Date(Date.now() - 13 * 864e5)), to: isoDate() });
  const valid = range !== 'custom' || (custom.from && custom.to && custom.from <= custom.to);
  const params = range === 'custom' ? { range, ...custom } : { range };
  return { range, setRange, custom, setCustom, params, valid, key: `${range}:${range === 'custom' ? `${custom.from}:${custom.to}` : ''}` };
}

export function CustomRange({ value, onChange }) {
  const min = isoDate(new Date(Date.now() - 365 * 864e5));
  return (
    <div className="flex flex-wrap items-end gap-2.5">
      <Field label="From" htmlFor="cr-from">
        <input id="cr-from" type="date" className="input" value={value.from} min={min} max={value.to} onChange={(e) => onChange({ ...value, from: e.target.value })} />
      </Field>
      <Field label="To" htmlFor="cr-to">
        <input id="cr-to" type="date" className="input" value={value.to} min={value.from} max={isoDate()} onChange={(e) => onChange({ ...value, to: e.target.value })} />
      </Field>
    </div>
  );
}
