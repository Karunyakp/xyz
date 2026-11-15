import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronLeft, Plus, Trash2, UploadCloud } from 'lucide-react';
import { useApp } from '../app/context';
import { useRows, useAction } from '../app/hooks';
import { eventService, storageService } from '../services';
import { categories, type CampusEvent, type Question } from '../domain/models';
import { eventSchema } from '../domain/validation';
import {
  Button,
  Card,
  PageHeader,
  SmartForm,
  QueryState,
  ErrorBox,
  type Field,
} from '../components/ui';
const stepNames = [
  'The idea',
  'When & where',
  'Make it yours',
  'Registration',
  'The experience',
  'Budget',
  'Review & submit',
];
export function EventWizard() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const source = id || params.get('clone') || '';
  const q = useQuery({
    queryKey: ['event', source],
    queryFn: () => eventService.get(source),
    enabled: !!source,
  });
  return (
    <QueryState loading={!!source && q.isLoading} error={q.error}>
      {(!source || q.data) && <Wizard key={source} source={q.data} editing={!!id} />}
    </QueryState>
  );
}
function Wizard({ source, editing }: { source?: CampusEvent; editing: boolean }) {
  const { institutionId } = useApp();
  const navigate = useNavigate();
  const action = useAction();
  const [step, setStep] = useState(0);
  const [data, setData] = useState<Record<string, unknown>>(
    source
      ? {
          ...source,
          title: editing ? source.title : source.title + ' (copy)',
          cover_path: editing ? source.cover_path : null,
          attachments: editing ? source.attachments : [],
        }
      : {
          category: 'Technical',
          event_type: 'Workshop',
          mode: 'offline',
          timezone: 'Asia/Kolkata',
          capacity: 100,
          waitlist_enabled: true,
          manual_approval: false,
          is_team: false,
          team_min: 2,
          team_max: 5,
          questions: [],
          agenda: [],
          faqs: [],
          attachments: [],
          eligible_departments: [],
          eligible_years: [],
          estimated_budget: 0,
        },
  );
  const [savedId, setSavedId] = useState(editing ? source?.id : undefined);
  const [error, setError] = useState<unknown>();
  const [questions, setQuestions] = useState<Question[]>(source?.questions || []);
  const [agenda, setAgenda] = useState(source?.agenda || []);
  const [faqs, setFaqs] = useState(source?.faqs || []);
  const categoryRows = useRows('global_categories');
  const categoryOptions =
    categoryRows.data?.filter((c) => c.enabled).map((c) => String(c.name)) || categories;
  const departments = useRows('departments'),
    clubs = useRows('clubs'),
    venues = useRows('venues');
  const opts = (records: { id: string; [k: string]: unknown }[] | undefined) =>
    records?.map((r) => ({ value: r.id, label: String(r.name) }));
  const fields: Field[][] = [
    [
      {
        name: 'title',
        label: 'Give your event a name',
        required: true,
        placeholder: 'Something people will remember',
      },
      {
        name: 'description',
        label: 'Tell the story',
        type: 'textarea',
        required: true,
        hint: 'Describe the experience in at least 20 characters.',
      },
      { name: 'objectives', label: 'What will participants take away?', type: 'textarea' },
      {
        name: 'category',
        label: 'Category',
        type: 'select',
        options: categoryOptions.map((c) => ({ value: c, label: c })),
        required: true,
      },
      { name: 'event_type', label: 'Event type', required: true },
      {
        name: 'department_id',
        label: 'Host department',
        type: 'select',
        options: opts(departments.data),
      },
      { name: 'club_id', label: 'Host club', type: 'select', options: opts(clubs.data) },
    ],
    [
      { name: 'starts_at', label: 'Starts', type: 'datetime-local', required: true },
      { name: 'ends_at', label: 'Ends', type: 'datetime-local', required: true },
      {
        name: 'registration_deadline',
        label: 'Registration closes',
        type: 'datetime-local',
        required: true,
      },
      {
        name: 'timezone',
        label: 'Event display timezone',
        required: true,
        hint: 'Dates are entered in your device timezone. Example display zone: Asia/Kolkata.',
      },
      {
        name: 'mode',
        label: 'Where will it happen?',
        type: 'select',
        options: ['offline', 'online', 'hybrid'].map((s) => ({ value: s, label: s })),
        required: true,
      },
      { name: 'venue_id', label: 'Venue', type: 'select', options: opts(venues.data) },
      { name: 'online_url', label: 'Online meeting link' },
    ],
    [],
    [
      { name: 'capacity', label: 'Participant capacity', type: 'number', min: 1, required: true },
      { name: 'waitlist_enabled', label: 'Offer a waitlist when full', type: 'checkbox' },
      { name: 'manual_approval', label: 'Review applications before confirming', type: 'checkbox' },
      { name: 'allow_external', label: 'Allow invited external participants', type: 'checkbox' },
      { name: 'is_team', label: 'Participants register in teams', type: 'checkbox' },
      { name: 'team_min', label: 'Minimum team members', type: 'number', min: 2 },
      { name: 'team_max', label: 'Maximum team members', type: 'number', min: 2 },
      {
        name: 'eligible_departments',
        label: 'Eligible department IDs',
        type: 'list',
        hint: 'Leave empty for all departments. Use IDs from department management.',
      },
      {
        name: 'eligible_years',
        label: 'Eligible academic years',
        type: 'list',
        hint: 'Comma-separated: 1, 2, 3, 4. Leave empty for all years.',
      },
    ],
    [
      {
        name: 'contact',
        label: 'Contact person / organiser email',
        type: 'textarea',
        required: true,
      },
      { name: 'instructions', label: 'Before participants arrive', type: 'textarea' },
      { name: 'rules', label: 'Rules & participation requirements', type: 'textarea' },
    ],
    [
      {
        name: 'estimated_budget',
        label: 'Estimated budget (INR)',
        type: 'number',
        min: 0,
        required: true,
      },
    ],
    [],
  ];
  const save = async (submit: boolean) => {
    setError(undefined);
    try {
      eventSchema.parse(data);
      const p = {
        ...data,
        questions,
        agenda,
        faqs,
        eligible_years: ((data.eligible_years as (string | number)[]) || []).map(Number),
      };
      const n = await eventService.save(institutionId, p, savedId);
      setSavedId(n);
      if (submit) await eventService.transition(n, 'PENDING_APPROVAL');
      await action.run(async () => undefined, submit ? 'Proposal submitted' : 'Draft saved');
      navigate('/events/' + n);
    } catch (e) {
      setError(e);
    }
  };
  const initial = Object.fromEntries(
    Object.entries(data).map(([k, v]) => [
      k,
      ['starts_at', 'ends_at', 'registration_deadline'].includes(k) && v
        ? new Date(new Date(String(v)).getTime() - new Date(String(v)).getTimezoneOffset() * 60000)
            .toISOString()
            .slice(0, 16)
        : v,
    ]),
  );
  return (
    <>
      <PageHeader
        eyebrow="MAKE SOMETHING HAPPEN"
        title={editing ? 'Refine your experience.' : 'Every great event starts with an idea.'}
        description="We’ll help you bring yours to campus, one step at a time."
      />
      <div className="wizard-layout">
        <aside className="wizard-steps">
          {stepNames.map((name, i) => (
            <button
              key={name}
              className={step === i ? 'active' : step > i ? 'complete' : ''}
              disabled={i > step}
              onClick={() => setStep(i)}
            >
              <span>{step > i ? <Check size={16} /> : String(i + 1).padStart(2, '0')}</span>
              <div>
                {name}
                <small>{i === step ? 'You’re here' : step > i ? 'Completed' : 'Coming up'}</small>
              </div>
            </button>
          ))}
        </aside>
        <Card className="wizard-form">
          <div className="eyebrow">STEP {step + 1} OF 7</div>
          <h2>{stepNames[step]}</h2>
          {step === 2 ? (
            <>
              <div className="upload-zone">
                <UploadCloud size={32} />
                <h3>Give your event a face</h3>
                <p>
                  Save a draft after scheduling to securely upload images and attachments. Files
                  belong to this event’s institution.
                </p>
                <Button
                  variant="secondary"
                  disabled={action.busy}
                  onClick={async () => {
                    const n = await action.run(
                      () =>
                        eventService.save(
                          institutionId,
                          { ...data, questions, agenda, faqs },
                          savedId,
                        ),
                      'Draft created for media uploads',
                    );
                    if (n) setSavedId(n);
                  }}
                >
                  Save draft for uploads
                </Button>
              </div>
              {savedId && (
                <>
                  <label className="field">
                    Cover image
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file)
                          void action.run(async () => {
                            const path = await storageService.upload(institutionId, savedId, file);
                            setData((d) => ({ ...d, cover_path: path }));
                          }, 'Cover uploaded');
                      }}
                    />
                  </label>
                  <label className="field">
                    Event attachment / gallery image
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,application/pdf"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file)
                          void action.run(async () => {
                            const path = await storageService.upload(institutionId, savedId, file);
                            setData((d) => ({
                              ...d,
                              attachments: [
                                ...((d.attachments as object[]) || []),
                                { name: file.name, path },
                              ],
                            }));
                          }, 'Attachment uploaded');
                      }}
                    />
                  </label>
                  <p>
                    {((data.attachments as object[]) || []).length} attachments ·{' '}
                    {data.cover_path ? 'Cover ready' : 'No cover yet'}
                  </p>
                </>
              )}
              <Button onClick={() => setStep(3)}>Continue</Button>
            </>
          ) : step === 6 ? (
            <>
              <div className="review-summary">
                <h2>{String(data.title)}</h2>
                <p>{String(data.description)}</p>
                <dl>
                  <dt>Starts</dt>
                  <dd>{new Date(String(data.starts_at)).toLocaleString()}</dd>
                  <dt>Capacity</dt>
                  <dd>{String(data.capacity)} participants</dd>
                  <dt>Estimated budget</dt>
                  <dd>₹{Number(data.estimated_budget || 0).toLocaleString('en-IN')}</dd>
                  <dt>Registration questions</dt>
                  <dd>{questions.length}</dd>
                  <dt>Approvals</dt>
                  <dd>
                    Institution policy applies. Publication is a separate step after approval.
                  </dd>
                </dl>
              </div>
              {error ? <ErrorBox error={error} /> : null}
              <div className="button-row">
                <Button variant="secondary" disabled={action.busy} onClick={() => save(false)}>
                  Save as draft
                </Button>
                <Button disabled={action.busy} onClick={() => save(true)}>
                  Submit for approval
                </Button>
              </div>
            </>
          ) : (
            <>
              {step === 3 && (
                <div className="builder">
                  <h3>Registration questions</h3>
                  {questions.map((q, i) => (
                    <div className="builder-row" key={q.id}>
                      <input
                        aria-label="Question label"
                        placeholder="Your question"
                        value={q.label}
                        onChange={(e) =>
                          setQuestions((list) =>
                            list.map((v, n) => (n === i ? { ...v, label: e.target.value } : v)),
                          )
                        }
                      />
                      <select
                        aria-label="Question type"
                        value={q.type}
                        onChange={(e) =>
                          setQuestions((list) =>
                            list.map((v, n) =>
                              n === i ? { ...v, type: e.target.value as Question['type'] } : v,
                            ),
                          )
                        }
                      >
                        <option value="text">Short answer</option>
                        <option value="textarea">Long answer</option>
                        <option value="select">Choice</option>
                      </select>
                      {q.type === 'select' && (
                        <input
                          aria-label="Options"
                          placeholder="Options, comma separated"
                          value={q.options?.join(',') || ''}
                          onChange={(e) =>
                            setQuestions((list) =>
                              list.map((v, n) =>
                                n === i ? { ...v, options: e.target.value.split(',') } : v,
                              ),
                            )
                          }
                        />
                      )}
                      <label>
                        <input
                          type="checkbox"
                          checked={q.required}
                          onChange={(e) =>
                            setQuestions((list) =>
                              list.map((v, n) =>
                                n === i ? { ...v, required: e.target.checked } : v,
                              ),
                            )
                          }
                        />
                        Required
                      </label>
                      <Button
                        variant="ghost"
                        aria-label="Remove question"
                        onClick={() => setQuestions((list) => list.filter((_, n) => n !== i))}
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  ))}
                  <Button
                    variant="secondary"
                    onClick={() =>
                      setQuestions((q) => [
                        ...q,
                        { id: crypto.randomUUID(), label: '', type: 'text', required: false },
                      ])
                    }
                  >
                    <Plus size={16} /> Add question
                  </Button>
                </div>
              )}
              {step === 4 && (
                <>
                  <div className="builder">
                    <h3>Schedule</h3>
                    {agenda.map((a, i) => (
                      <div className="builder-row" key={i}>
                        <input
                          type="time"
                          aria-label="Agenda time"
                          value={a.time}
                          onChange={(e) =>
                            setAgenda((list) =>
                              list.map((v, n) => (n === i ? { ...v, time: e.target.value } : v)),
                            )
                          }
                        />
                        <input
                          placeholder="Session title"
                          aria-label="Session title"
                          value={a.title}
                          onChange={(e) =>
                            setAgenda((list) =>
                              list.map((v, n) => (n === i ? { ...v, title: e.target.value } : v)),
                            )
                          }
                        />
                        <Button
                          variant="ghost"
                          onClick={() => setAgenda((list) => list.filter((_, n) => n !== i))}
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                    <Button
                      variant="secondary"
                      onClick={() => setAgenda((a) => [...a, { time: '09:00', title: '' }])}
                    >
                      Add session
                    </Button>
                  </div>
                  <div className="builder">
                    <h3>FAQs</h3>
                    {faqs.map((a, i) => (
                      <div className="builder-row" key={i}>
                        <input
                          placeholder="Question"
                          aria-label="FAQ question"
                          value={a.question}
                          onChange={(e) =>
                            setFaqs((list) =>
                              list.map((v, n) =>
                                n === i ? { ...v, question: e.target.value } : v,
                              ),
                            )
                          }
                        />
                        <input
                          placeholder="Answer"
                          aria-label="FAQ answer"
                          value={a.answer}
                          onChange={(e) =>
                            setFaqs((list) =>
                              list.map((v, n) => (n === i ? { ...v, answer: e.target.value } : v)),
                            )
                          }
                        />
                        <Button
                          variant="ghost"
                          onClick={() => setFaqs((list) => list.filter((_, n) => n !== i))}
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                    <Button
                      variant="secondary"
                      onClick={() => setFaqs((a) => [...a, { question: '', answer: '' }])}
                    >
                      Add FAQ
                    </Button>
                  </div>
                </>
              )}
              {step === 5 && (
                <p className="info">
                  All registrations are free. Expense approvals, sponsorships and receipts are
                  managed in Budgets & finance after creation. Online payments require a separately
                  configured provider.
                </p>
              )}
              <SmartForm
                key={step}
                fields={fields[step]}
                initial={initial}
                submitLabel="Save & continue"
                onSubmit={async (p) => {
                  setData((d) => ({ ...d, ...p }));
                  setStep((s) => s + 1);
                }}
              />
            </>
          )}
          {step > 0 && (
            <Button className="back-step" variant="ghost" onClick={() => setStep((s) => s - 1)}>
              <ChevronLeft size={16} /> Previous step
            </Button>
          )}
        </Card>
      </div>
    </>
  );
}
