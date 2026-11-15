import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Download } from 'lucide-react';
import { useApp } from '../app/context';
import { useRows, useAction } from '../app/hooks';
import { analyticsService, institutionService } from '../services';
import { exportRows } from '../services/exportService';
import type { DataRow } from '../domain/models';
import {
  Card,
  Button,
  PageHeader,
  QueryState,
  DataTable,
  Modal,
  SmartForm,
  type Field,
} from '../components/ui';

const termFields: Field[] = [
  { name: 'name', label: 'Term name', required: true, placeholder: 'Semester 1' },
  { name: 'academic_year', label: 'Academic year', required: true, placeholder: '2026–2027' },
  { name: 'starts_on', label: 'First day (UTC)', type: 'date', required: true },
  { name: 'ends_on', label: 'End date (exclusive, UTC)', type: 'date', required: true },
];
export function AcademicTerms() {
  const { institutionId } = useApp();
  const q = useRows('academic_terms', { order: 'starts_on', ascending: false });
  const action = useAction();
  const [editing, setEditing] = useState<DataRow | null | undefined>();
  return (
    <>
      <PageHeader
        eyebrow="ACADEMIC STRUCTURE"
        title="A rhythm for your campus."
        description="Define semesters and academic years for consistent institutional reporting."
        action={
          <Button onClick={() => setEditing(null)}>
            <Plus size={16} /> Add term
          </Button>
        }
      />
      <Card>
        <QueryState loading={q.isLoading} error={q.error}>
          <DataTable
            rows={q.data || []}
            columns={termFields.map((f) => ({ key: f.name, label: f.label }))}
            actions={(row) => (
              <Button variant="secondary" onClick={() => setEditing(row)}>
                Edit term
              </Button>
            )}
          />
        </QueryState>
      </Card>
      <Modal
        title={editing ? 'Edit academic term' : 'Add academic term'}
        open={editing !== undefined}
        onOpenChange={(open) => {
          if (!open) setEditing(undefined);
        }}
      >
        <SmartForm
          fields={termFields}
          initial={editing || {}}
          onSubmit={async (p) => {
            if (String(p.ends_on) <= String(p.starts_on))
              throw new Error('End date must follow the first day.');
            await institutionService.term(institutionId, p, editing?.id);
            await action.run(async () => true, 'Academic term saved');
            setEditing(undefined);
          }}
        />
      </Modal>
    </>
  );
}

export function PeriodComparison() {
  const { institutionId } = useApp();
  const terms = useRows('academic_terms', { order: 'starts_on', ascending: false });
  const year = new Date().getUTCFullYear();
  const [left, setLeft] = useState({
    label: String(year - 1),
    from: `${year - 1}-01-01`,
    to: `${year}-01-01`,
  });
  const [right, setRight] = useState({
    label: String(year),
    from: `${year}-01-01`,
    to: `${year + 1}-01-01`,
  });
  const valid = (p: typeof left) => !!p.from && !!p.to && p.to > p.from;
  const a = useQuery({
    queryKey: ['period-comparison', institutionId, left],
    queryFn: () =>
      analyticsService.get(institutionId, `${left.from}T00:00:00Z`, `${left.to}T00:00:00Z`),
    enabled: !!institutionId && valid(left),
  });
  const b = useQuery({
    queryKey: ['period-comparison', institutionId, right],
    queryFn: () =>
      analyticsService.get(institutionId, `${right.from}T00:00:00Z`, `${right.to}T00:00:00Z`),
    enabled: !!institutionId && valid(right),
  });
  const action = useAction();
  const metrics = [
    ['events', 'Events'],
    ['registrations', 'Registrations'],
    ['unique_participants', 'Participants'],
    ['attendance', 'Attendance'],
    ['confirmed', 'Confirmed seats'],
  ] as const;
  const rows =
    a.data && b.data
      ? metrics.map(([key, label]) => ({
          id: key,
          metric: label,
          first: a.data![key],
          second: b.data![key],
          change: b.data![key] - a.data![key],
        }))
      : [];
  function selector(value: typeof left, set: (value: typeof left) => void, label: string) {
    return (
      <div>
        <label>
          {label} preset
          <select
            aria-label={label + ' preset'}
            value=""
            onChange={(e) => {
              const term = terms.data?.find((t) => t.id === e.target.value);
              if (term)
                set({
                  label: `${term.name} · ${term.academic_year}`,
                  from: String(term.starts_on),
                  to: String(term.ends_on),
                });
            }}
          >
            <option value="">Choose academic term…</option>
            {terms.data?.map((t) => (
              <option key={t.id} value={t.id}>
                {String(t.name)} · {String(t.academic_year)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {label} label
          <input value={value.label} onChange={(e) => set({ ...value, label: e.target.value })} />
        </label>
        <div className="report-filters">
          <label>
            From
            <input
              type="date"
              value={value.from}
              onChange={(e) => set({ ...value, from: e.target.value })}
            />
          </label>
          <label>
            Until (exclusive)
            <input
              type="date"
              value={value.to}
              onChange={(e) => set({ ...value, to: e.target.value })}
            />
          </label>
        </div>
      </div>
    );
  }
  return (
    <Card>
      <div className="section-title">
        <div>
          <div className="eyebrow">MEASURE PROGRESS</div>
          <h2>Compare semesters or years</h2>
        </div>
        <Button
          variant="secondary"
          disabled={!rows.length || action.busy}
          onClick={() =>
            action.run(
              () =>
                exportRows(
                  rows.map((r) => ({
                    metric: r.metric,
                    first_period: left.label,
                    first_value: r.first,
                    second_period: right.label,
                    second_value: r.second,
                    change: r.change,
                  })),
                  'PLANORA-Period-Comparison',
                ),
              'Comparison exported',
            )
          }
        >
          <Download size={16} /> Export
        </Button>
      </div>
      <p className="muted">
        Events are grouped by start date using UTC date boundaries. Your authorised scope applies to
        both periods.
      </p>
      <div className="two-col">
        {selector(left, setLeft, 'First period')}
        {selector(right, setRight, 'Second period')}
      </div>
      <QueryState loading={terms.isLoading} error={terms.error}>
        <span />
      </QueryState>
      {!valid(left) || !valid(right) ? (
        <p role="alert">Choose an end date after the start date in both periods.</p>
      ) : (
        <QueryState loading={a.isLoading || b.isLoading} error={a.error || b.error}>
          <DataTable
            rows={rows}
            columns={[
              { key: 'metric', label: 'Metric' },
              { key: 'first', label: left.label },
              { key: 'second', label: right.label },
              { key: 'change', label: 'Change' },
            ]}
          />
        </QueryState>
      )}
    </Card>
  );
}
