import * as Dialog from '@radix-ui/react-dialog';
import { X, ArrowUpRight, Inbox, LoaderCircle, AlertCircle } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from './Button';
export { Button };
export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: string }) {
  return <span className={'badge ' + tone}>{children}</span>;
}
export function StatusBadge({ value }: { value: string }) {
  return (
    <Badge
      tone={
        [
          'confirmed',
          'APPROVED',
          'PUBLISHED',
          'REGISTRATION_OPEN',
          'COMPLETED',
          'accepted',
          'done',
          'approved',
        ].includes(value)
          ? 'green'
          : ['PENDING_APPROVAL', 'pending', 'waitlisted', 'invited', 'REVISION_REQUESTED'].includes(
                value,
              )
            ? 'amber'
            : ['CANCELLED', 'REJECTED', 'cancelled', 'rejected', 'expired'].includes(value)
              ? 'red'
              : 'neutral'
      }
    >
      {value.replaceAll('_', ' ').toLowerCase()}
    </Badge>
  );
}
export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <header className="page-heading">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action}
    </header>
  );
}
export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={'card ' + className}>{children}</section>;
}
export function Empty({
  title = 'Nothing here yet',
  text = 'New records will appear here.',
  action,
}: {
  title?: string;
  text?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Inbox size={26} />
      </div>
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}
export function Loading() {
  return (
    <div className="loading" role="status">
      <LoaderCircle className="spin" size={22} /> Loading your campus…
    </div>
  );
}
export function ErrorBox({ error }: { error: unknown }) {
  return (
    <div className="error" role="alert">
      <AlertCircle size={20} />
      <span>{error instanceof Error ? error.message : String(error)}</span>
    </div>
  );
}
export function QueryState({
  loading,
  error,
  children,
}: {
  loading: boolean;
  error: unknown;
  children: ReactNode;
}) {
  return loading ? <Loading /> : error ? <ErrorBox error={error} /> : <>{children}</>;
}
export function Modal({
  title,
  description,
  open,
  onOpenChange,
  children,
}: {
  title: string;
  description?: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  children: ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="modal-overlay" />
        <Dialog.Content className="modal">
          <div className="modal-head">
            <div>
              <Dialog.Title>{title}</Dialog.Title>
              <Dialog.Description>
                {description || 'Complete the details below.'}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" aria-label="Close dialog">
                <X size={20} />
              </Button>
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export interface Field {
  name: string;
  label: string;
  type?:
    | 'text'
    | 'email'
    | 'password'
    | 'number'
    | 'datetime-local'
    | 'date'
    | 'textarea'
    | 'select'
    | 'checkbox'
    | 'json'
    | 'list';
  required?: boolean;
  options?: { value: string; label: string }[];
  hint?: string;
  min?: number;
  max?: number;
  placeholder?: string;
}
export function SmartForm({
  fields,
  initial = {},
  onSubmit,
  submitLabel = 'Save changes',
}: {
  fields: Field[];
  initial?: Record<string, unknown>;
  onSubmit: (data: Record<string, unknown>) => Promise<unknown>;
  submitLabel?: string;
}) {
  const defaults = Object.fromEntries(
    fields.map((f) => {
      const v = initial[f.name];
      return [
        f.name,
        f.type === 'json'
          ? JSON.stringify(v ?? [], null, 2)
          : f.type === 'list' && Array.isArray(v)
            ? v.join(', ')
            : (v ?? (f.type === 'checkbox' ? false : '')),
      ];
    }),
  );
  const {
    register,
    handleSubmit,
    formState: { isSubmitting, errors },
  } = useForm({ defaultValues: defaults });
  const [error, setError] = useState<unknown>();
  return (
    <form
      className="smart-form"
      onSubmit={handleSubmit(async (raw) => {
        setError(undefined);
        try {
          const values = { ...raw };
          for (const f of fields) {
            if (f.type === 'json') values[f.name] = JSON.parse(String(raw[f.name] || '[]'));
            if (f.type === 'list')
              values[f.name] = String(raw[f.name] || '')
                .split(',')
                .map((v) => v.trim())
                .filter(Boolean);
            if (f.type === 'number' && raw[f.name] !== '') values[f.name] = Number(raw[f.name]);
            if (f.type === 'datetime-local' && raw[f.name])
              values[f.name] = new Date(String(raw[f.name])).toISOString();
          }
          await onSubmit(values);
        } catch (e) {
          setError(e);
        }
      })}
    >
      {fields.map((f) => (
        <label className={'field ' + (f.type === 'checkbox' ? 'check-field' : '')} key={f.name}>
          <span>
            {f.label}
            {f.required && <b aria-hidden="true"> *</b>}
          </span>
          {f.type === 'textarea' || f.type === 'json' ? (
            <textarea
              rows={f.type === 'json' ? 5 : 3}
              {...register(f.name, { required: f.required })}
              placeholder={f.placeholder}
            />
          ) : f.type === 'select' ? (
            <select {...register(f.name, { required: f.required })}>
              <option value="">Select…</option>
              {f.options?.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              type={f.type === 'list' ? 'text' : f.type || 'text'}
              {...register(f.name, { required: f.required, min: f.min, max: f.max })}
              min={f.min}
              max={f.max}
              placeholder={f.placeholder}
            />
          )}{' '}
          {f.hint && <small>{f.hint}</small>}
          {errors[f.name] && <small className="text-red">Check this field.</small>}
        </label>
      ))}
      {error ? <ErrorBox error={error} /> : null}
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? <LoaderCircle className="spin" size={16} /> : null}
        {isSubmitting ? 'Saving…' : submitLabel}
        <ArrowUpRight size={16} />
      </Button>
    </form>
  );
}
export function DataTable<T extends Record<string, unknown>>({
  rows,
  columns,
  actions,
}: {
  rows: T[];
  columns: { key: string; label: string; render?: (row: T) => ReactNode }[];
  actions?: (row: T) => ReactNode;
}) {
  if (!rows.length) return <Empty text="There are no matching records." />;
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key}>{c.label}</th>
            ))}
            {actions && <th>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={String(r.id ?? r.user_id ?? i)}>
              {columns.map((c) => (
                <td key={c.key}>
                  {c.render
                    ? c.render(r)
                    : r[c.key] === null || r[c.key] === undefined
                      ? '—'
                      : typeof r[c.key] === 'object'
                        ? JSON.stringify(r[c.key])
                        : String(r[c.key])}
                </td>
              ))}
              {actions && (
                <td>
                  <div className="table-actions">{actions(r)}</div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function Metric({
  label,
  value,
  detail,
  icon,
}: {
  label: string;
  value: string | number;
  detail?: string;
  icon: ReactNode;
}) {
  return (
    <Card className="metric">
      <div>
        <span>{label}</span>
        {icon}
      </div>
      <strong>{value}</strong>
      {detail && <small>{detail}</small>}
    </Card>
  );
}
