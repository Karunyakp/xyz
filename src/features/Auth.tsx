import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowUpRight,
  Check,
  ShieldCheck,
  CalendarDays,
  Users,
  Layers3,
  Terminal,
  Lock,
} from 'lucide-react';
import { Button, Card, ErrorBox, SmartForm } from '../components/ui';
import { authService, institutionService } from '../services';
import { supabase } from '../infrastructure/supabase';
import { useApp } from '../app/context';
import { signUpSchema } from '../domain/validation';
export function Brand() {
  return (
    <Link to="/" className="brand">
      <img src="/logo.svg" alt="" />
      <strong>
        PLANORA<span>campus, connected.</span>
      </strong>
    </Link>
  );
}
export function AuthPage() {
  const location = useLocation(),
    nav = useNavigate();
  const reset = location.pathname === '/reset-password';
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>('login');
  const [message, setMessage] = useState('');
  const [prefed, setPrefed] = useState<{ role: string; department?: string; name?: string } | null>(null);
  const [selectedRole, setSelectedRole] = useState<'student' | 'faculty' | 'organiser'>('student');

  useEffect(() => {
    if (mode !== 'signup' || !emailInput.includes('@') || !supabase) {
      setPrefed(null);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const { data } = await supabase!
          .from('invitations')
          .select('role, departments(name)')
          .eq('email', emailInput.toLowerCase().trim())
          .is('accepted_at', null)
          .maybeSingle();
        if (data) {
          const dept = (data.departments as unknown as { name?: string })?.name;
          setPrefed({
            role: data.role,
            department: dept,
          });
        } else {
          setPrefed(null);
        }
      } catch {
        setPrefed(null);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [emailInput, mode]);
  return (
    <div className="auth-screen">
      <section className="auth-story">
        <Brand />
        <div>
          <div className="eyebrow">THE CAMPUS EXPERIENCE, REIMAGINED</div>
          <h1>
            Good things
            <br />
            happen when
            <br />
            <em>we come together.</em>
          </h1>
          <p>
            Find your people. Make something happen.
            <br />
            One connected home for your campus.
          </p>
          <div className="orbit-art">
            <div className="orbit-ring ring-one" />
            <div className="orbit-ring ring-two" />
            <div className="orbit-ring ring-three" />
            <span className="orbit-item one">
              <CalendarDays /> A moment worth making
            </span>
            <span className="orbit-item two">
              <Users /> Your kind of community
            </span>
            <span className="orbit-item three">
              <Layers3 /> Every detail, connected
            </span>
            <div className="orbit-center">
              p<span>•</span>
            </div>
          </div>
        </div>
        <small>Discover. Participate. Make your mark.</small>
      </section>
      <section className="auth-panel">
        <div className="auth-top">
          <span>YOUR NEXT CHAPTER STARTS HERE</span>
          <ShieldCheck size={18} />
        </div>
        <div className="auth-form">
          <BadgeLabel />
          <h2>
            {reset
              ? 'Choose a new password'
              : mode === 'signup'
                ? 'Your campus awaits.'
                : mode === 'forgot'
                  ? 'Let’s get you back in.'
                  : 'Welcome back.'}
          </h2>
          <p>
            {mode === 'signup'
              ? 'Create your account. Your institution controls membership and permissions.'
              : reset
                ? 'Use a unique password with at least 12 characters.'
                : 'Sign in to the experiences, people and possibilities on your campus.'}
          </p>
          {message ? (
            <div className="success">
              <Check size={18} />
              {message}
            </div>
          ) : (
            <>
              {mode === 'signup' && prefed && (
                <div className="p-3 mb-4 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-start gap-2">
                  <Lock size={16} className="mt-0.5 text-emerald-600 shrink-0" />
                  <div>
                    <strong>Verified Institutional Record Found</strong>
                    <div className="text-xs text-emerald-700 mt-0.5">
                      Assigned Role: <span className="font-semibold uppercase">{prefed.role}</span>
                      {prefed.department && ` • Department: ${prefed.department}`}
                    </div>
                    <div className="text-[11px] text-emerald-600 mt-1">
                      This role was pre-configured by your college administrator and is locked for security.
                    </div>
                  </div>
                </div>
              )}
              {mode === 'signup' && !prefed && (
                <div className="mb-4">
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">Select your intended campus role</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'student', label: 'Student' },
                      { id: 'faculty', label: 'Faculty / Staff' },
                      { id: 'organiser', label: 'Club / Lead' },
                    ].map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setSelectedRole(r.id as any)}
                        className={`py-2 px-2.5 text-xs font-medium rounded-md border text-center transition-all ${
                          selectedRole === r.id
                            ? 'bg-blue-50 border-blue-600 text-blue-700 ring-1 ring-blue-600'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                  {selectedRole !== 'student' && (
                    <p className="text-[11px] text-amber-700 mt-1.5 bg-amber-50 p-2 rounded border border-amber-200">
                      ⚠️ Note: Faculty and Organizer accounts require verification by your College Admin in People & Access before elevated privileges are active.
                    </p>
                  )}
                </div>
              )}
              <SmartForm
                key={mode + reset}
                fields={
                  reset
                    ? [{ name: 'password', label: 'New password', type: 'password', required: true }]
                    : mode === 'forgot'
                      ? [{ name: 'email', label: 'Email address', type: 'email', required: true }]
                      : [
                          ...(mode === 'signup'
                            ? [{ name: 'full_name', label: 'Full name', required: true }]
                            : []),
                          {
                            name: 'email',
                            label: 'Institution email',
                            type: 'email',
                            required: true,
                          },
                          { name: 'password', label: 'Password', type: 'password', required: true },
                        ]
                }
                submitLabel={
                  reset
                    ? 'Update password'
                    : mode === 'signup'
                      ? 'Create account'
                      : mode === 'forgot'
                        ? 'Send reset link'
                        : 'Sign in'
                }
                onSubmit={async (p) => {
                  if (reset) {
                    if (String(p.password).length < 12) throw new Error('Use at least 12 characters');
                    await authService.password(String(p.password));
                    nav('/');
                    return;
                  }
                  if (mode === 'signup') {
                    const v = signUpSchema.parse(p);
                    await authService.signup(v.email, v.password, v.full_name, prefed ? prefed.role : selectedRole);
                    setMessage('Check your email to verify your account.');
                  } else if (mode === 'forgot') {
                    await authService.reset(String(p.email));
                    setMessage('If an account exists, a reset email is on its way.');
                  } else {
                    await authService.login(String(p.email), String(p.password));
                    nav('/');
                  }
                }}
              />
            </>
          )}{' '}
          {!reset && (
            <div className="auth-links">
              <button
                onClick={() => {
                  setMessage('');
                  setMode(mode === 'signup' ? 'login' : 'signup');
                }}
              >
                {mode === 'signup'
                  ? 'Already have an account? Sign in'
                  : 'New here? Create an account'}{' '}
                <ArrowUpRight size={14} />
              </button>
              <button
                onClick={() => {
                  setMessage('');
                  setMode('forgot');
                }}
              >
                Forgot password?
              </button>
            </div>
          )}
          <div className="secure-note">
            <ShieldCheck size={16} /> Secure access. Institution-controlled roles.
          </div>
        </div>
        <small>PLANORA · A little less admin. A lot more campus.</small>
      </section>
    </div>
  );
}
function BadgeLabel() {
  return (
    <div className="auth-label">
      <span /> YOUR CAMPUS, IN ONE PLACE
    </div>
  );
}
export function SetupPage() {
  return (
    <div className="setup-page">
      <Brand />
      <div className="setup-grid">
        <section>
          <div className="eyebrow">READY FOR YOUR INSTITUTION</div>
          <h1>
            A connected campus.
            <br />
            <em>Built on real data.</em>
          </h1>
          <p>
            PLANORA is ready to connect to your Supabase project. Add your project configuration to
            activate secure accounts, events and campus operations.
          </p>
          <div className="setup-features">
            <span>
              <ShieldCheck /> Isolated institutional data
            </span>
            <span>
              <Users /> Roles at every level
            </span>
            <span>
              <CalendarDays /> The whole event lifecycle
            </span>
          </div>
        </section>
        <Card>
          <Terminal size={28} />
          <h2>Connect your workspace</h2>
          <ol>
            <li>
              Copy <code>.env.example</code> to <code>.env</code>.
            </li>
            <li>Set your Supabase project URL and publishable key.</li>
            <li>Apply the included database migrations.</li>
            <li>Bootstrap the first platform administrator and restart the app.</li>
          </ol>
          <div className="code-block">
            VITE_SUPABASE_URL
            <br />
            VITE_SUPABASE_PUBLISHABLE_KEY
          </div>
          <p className="muted">
            Follow SETUP.md in the source project. Never use a service-role key in browser
            configuration.
          </p>
          <div className="setup-status">
            <span /> Awaiting Supabase configuration
          </div>
        </Card>
      </div>
      <footer>PLANORA / Discover · Organise · Connect</footer>
    </div>
  );
}
export function OnboardingPage() {
  const { refresh, error } = useApp();
  const [notice, setNotice] = useState('');
  return (
    <div className="onboarding">
      <Brand />
      <Card>
        <h1>Let’s find your campus.</h1>
        <p>
          Join with your institution’s slug and a verified institutional email, or accept an
          invitation.
        </p>
        {error ? <ErrorBox error={error} /> : null}
        <SmartForm
          fields={[
            {
              name: 'slug',
              label: 'Institution slug',
              required: true,
              placeholder: 'your-college',
            },
          ]}
          submitLabel="Join institution"
          onSubmit={async (p) => {
            await institutionService.join(String(p.slug));
            await refresh();
          }}
        />
        <div className="divider">OR</div>
        <Button
          variant="secondary"
          onClick={async () => {
            try {
              const n = await authService.accept();
              setNotice(
                n
                  ? 'Invitations accepted.'
                  : 'No pending invitations match your verified email. Ask your institution administrator for access.',
              );
              await refresh();
            } catch (e) {
              setNotice(String(e));
            }
          }}
        >
          Accept my invitations
        </Button>
        {notice && <p role="status">{notice}</p>}
        <Button variant="ghost" onClick={() => authService.logout()}>
          Sign out
        </Button>
      </Card>
    </div>
  );
}
