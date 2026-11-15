import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import {
  LayoutDashboard,
  Compass,
  CalendarDays,
  Ticket,
  Users,
  Briefcase,
  Medal,
  Bell,
  UserRound,
  Plus,
  ScanLine,
  ClipboardList,
  Wallet,
  BarChart3,
  Settings,
  Building2,
  ShieldCheck,
  MapPin,
  Boxes,
  ScrollText,
  Menu,
  X,
  LogOut,
  ArrowUpRight,
  LifeBuoy,
} from 'lucide-react';
import { SecureImage } from '../components/SecureImage';
import { Brand } from '../features/Auth';
import { useApp } from './context';
import { Button } from '../components/ui';
import { authService } from '../services';
import { useRows } from './hooks';
export function Layout() {
  const { context, institution, institutionId, setInstitution, can } = useApp();
  const [open, setOpen] = useState(false);
  const notices = useRows('notifications', { limit: 100 });
  const unread = notices.data?.filter((n) => !n.read_at).length || 0;
  const student = [
    ['/', 'Home', LayoutDashboard],
    ['/explore', 'Explore events', Compass],
    ['/calendar', 'Calendar', CalendarDays],
    ['/my-events', 'My events', Ticket],
    ['/clubs', 'Clubs & communities', Users],
    ['/opportunities', 'Opportunities', Briefcase],
    ['/passport', 'Event passport', Medal],
  ] as const;
  const ops = [
    ['/workspace', 'Overview', LayoutDashboard, 'report.read'],
    ['/manage-events', 'Manage events', CalendarDays, 'event.manage'],
    ['/create-event', 'Create event', Plus, 'event.create'],
    ['/approvals', 'Faculty reviews', ShieldCheck, 'event.approve'],
    ['/registrations', 'Registrations', Ticket, 'registration.manage'],
    ['/check-in', 'QR check-in', ScanLine, 'attendance.scan'],
    ['/operations', 'Event operations', ClipboardList, 'event.manage'],
    ['/volunteers', 'Volunteers', Users, 'event.manage'],
    ['/team-access', 'Team responsibilities', Users, 'event.manage'],
    ['/announcements', 'Announcements', Bell, 'event.manage'],
    ['/certificates', 'Certificates', Medal, 'certificate.manage'],
    ['/feedback', 'Feedback', ScrollText, 'report.read'],
    ['/finance', 'Budgets & finance', Wallet, 'budget.manage'],
    ['/reports', 'Reports', BarChart3, 'report.read'],
  ] as const;
  const admin = [
    ['/academic-terms', 'Academic terms', CalendarDays, 'directory.manage'],
    ['/users', 'People & access', Users, 'users.manage'],
    ['/departments', 'Departments', Building2, 'directory.manage'],
    ['/manage-clubs', 'Manage clubs', Users, 'directory.manage'],
    ['/venues', 'Venues', MapPin, 'directory.manage'],
    ['/resources', 'Resources', Boxes, 'directory.manage'],
    ['/audit', 'Audit log', ScrollText, 'audit.read'],
    ['/settings', 'Institution settings', Settings, 'institution.manage'],
  ] as const;
  const item = (to: string, label: string, Icon: typeof Users) => (
    <NavLink
      key={to}
      to={to}
      end={to === '/'}
      onClick={() => setOpen(false)}
      className={({ isActive }) => 'nav-item ' + (isActive ? 'active' : '')}
    >
      <Icon size={18} />
      <span>{label}</span>
    </NavLink>
  );
  return (
    <div className="app-shell">
      <button
        className={'sidebar-shade ' + (open ? 'show' : '')}
        aria-label="Close navigation"
        onClick={() => setOpen(false)}
      />
      <aside className={'sidebar ' + (open ? 'open' : '')}>
        <div className="sidebar-brand">
          <Brand />
          <Button
            className="mobile-only"
            variant="ghost"
            onClick={() => setOpen(false)}
            aria-label="Close navigation"
          >
            <X size={20} />
          </Button>
        </div>
        <div className="campus-switch">
          <div className="campus-icon">
            {institution?.logo_path ? (
              <SecureImage path={institution.logo_path} alt={institution.name} />
            ) : (
              <Building2 size={20} />
            )}
          </div>
          <div>
            <small>YOUR CAMPUS</small>
            <select
              aria-label="Institution"
              value={institutionId}
              onChange={(e) => setInstitution(e.target.value)}
            >
              {context?.institutions.map((i) => (
                <option value={i.id} key={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <nav>
          <div className="nav-label">YOUR CAMPUS</div>
          {student
            .filter(
              ([to]) =>
                context?.memberships.find((m) => m.institution_id === institutionId)?.kind !==
                  'external' || !['/clubs', '/opportunities'].includes(to),
            )
            .map(([to, label, I]) => item(to, label, I))}
          {ops.some((x) => can(x[3])) && <div className="nav-label">WORKSPACE</div>}
          {ops
            .filter((x) => can(x[3]) || (x[0] === '/finance' && can('budget.approve')))
            .map(([to, label, I]) => item(to, label, I))}
          {admin.some((x) => can(x[3])) && <div className="nav-label">ADMINISTRATION</div>}
          {admin.filter((x) => can(x[3])).map(([to, label, I]) => item(to, label, I))}
          {context?.platform_admin && item('/platform', 'Platform console', ShieldCheck)}
        </nav>
        <div className="sidebar-bottom">
          <Link to="/support" className="help-card">
            <LifeBuoy size={20} />
            <div>
              Need a hand?<small>Campus support</small>
            </div>
            <ArrowUpRight size={15} />
          </Link>
          <Link to="/profile" className="profile-chip">
            <div className="avatar">{context?.profile.full_name?.slice(0, 1) || 'P'}</div>
            <div>
              <strong>{context?.profile.full_name || 'Your account'}</strong>
              <small>
                {context?.memberships.find((m) => m.institution_id === institutionId)?.kind ||
                  'Member'}
              </small>
            </div>
            <UserRound size={17} />
          </Link>
        </div>
      </aside>
      <div className="main-wrap">
        <header className="topbar">
          <div className="topbar-left">
            <Button
              variant="ghost"
              className="mobile-only"
              aria-label="Open navigation"
              onClick={() => setOpen(true)}
            >
              <Menu size={20} />
            </Button>
            <span className="breadcrumb">
              Campus life <span>/</span> <strong>{institution?.name}</strong>
            </span>
          </div>
          <div className="topbar-actions">
            <span className="live-dot">Your campus, connected</span>
            <Link
              className="notification-link"
              to="/notifications"
              aria-label={`${unread} unread notifications`}
            >
              <Bell size={20} />
              {unread > 0 && <span>{unread}</span>}
            </Link>
            <Button variant="ghost" onClick={() => authService.logout()} aria-label="Sign out">
              <LogOut size={18} />
            </Button>
          </div>
        </header>
        <main id="main">
          <Outlet />
        </main>
        <footer className="app-footer">
          <span>PLANORA</span>
          <small>More moments. Less admin.</small>
          <Link to="/support">
            Help & support <ArrowUpRight size={12} />
          </Link>
        </footer>
      </div>
    </div>
  );
}
