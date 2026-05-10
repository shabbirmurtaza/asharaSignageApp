import { useEffect, useMemo, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  CalendarDays,
  ChevronRight,
  Inbox,
  KanbanSquare,
  LayoutDashboard,
  Library,
  ListChecks,
  MapPin,
  Package,
  Plus,
  Ruler,
  Tags,
  UserCog,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { isSignageHod, isSignageProduction, isSuperAdmin } from '@/lib/rbac';
import { useChromeEvent } from '@/hooks/useChromeEvent';
import { accentTokens } from '@/lib/accent';
import { EventSwitcher } from './EventSwitcher';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  children?: NavItem[];
}

interface NavSection {
  title: string;
  titleLisan?: string;
  items: NavItem[];
}

const useSections = (): NavSection[] => {
  const session = useAuth((s) => s.session);
  if (!session) return [];

  const sections: NavSection[] = [];

  if (isSuperAdmin(session)) {
    sections.push({
      title: 'Admin',
      items: [
        { to: '/admin/events', label: 'Events', icon: CalendarDays },
        { to: '/admin/venues', label: 'Venues', icon: MapPin },
        { to: '/admin/departments', label: 'Departments', icon: Tags },
        { to: '/admin/sizes', label: 'Sizes', icon: Ruler },
        {
          to: '/admin/users',
          label: 'Users',
          icon: Users,
          children: [
            {
              to: '/admin/users/approvals',
              label: 'Signup Approvals',
              icon: UserCog,
            },
          ],
        },
      ],
    });
  }

  if (isSignageHod(session, null, null)) {
    sections.push({
      title: 'Signage HOD',
      items: [
        { to: '/hod/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { to: '/hod/approvals', label: 'Approvals', icon: Inbox },
      ],
    });
  }

  if (isSignageProduction(session, null)) {
    sections.push({
      title: 'Production',
      items: [
        { to: '/production/pipeline', label: 'Pipeline', icon: KanbanSquare },
      ],
    });
  }

  const hasDeptAssignment = session.assignments.some(
    (a) =>
      a.role === 'department_user' &&
      a.event_id &&
      a.venue_id &&
      a.department_id,
  );
  if (hasDeptAssignment) {
    sections.push({
      title: 'My Requests',
      items: [
        { to: '/my/requests', label: 'My Requests', icon: ListChecks },
        { to: '/my/requests/new', label: 'New Request', icon: Package },
      ],
    });
  }

  const canCreateSign =
    isSuperAdmin(session) ||
    isSignageHod(session, null, null) ||
    hasDeptAssignment;
  const libraryItem: NavItem = {
    to: '/library',
    label: 'Sign Library',
    icon: Library,
  };
  if (canCreateSign) {
    libraryItem.children = [
      { to: '/library/new', label: 'New Sign', icon: Plus },
    ];
  }
  sections.push({ title: 'Library', items: [libraryItem] });

  return sections;
};

interface SidebarBodyProps {
  onNavigate?: () => void;
  showSwitcher?: boolean;
}

const isPathActive = (pathname: string, to: string, exact = false) => {
  if (exact) return pathname === to;
  return pathname === to || pathname.startsWith(`${to}/`);
};

const SidebarBody = ({ onNavigate, showSwitcher }: SidebarBodyProps) => {
  const sections = useSections();
  const event = useChromeEvent();
  const accent = accentTokens(event.data?.brand_primary);
  const location = useLocation();

  const initialExpanded = useMemo(() => {
    const expanded: Record<string, boolean> = {};
    for (const section of sections) {
      for (const item of section.items) {
        if (!item.children?.length) continue;
        const anyChildActive = item.children.some((c) =>
          isPathActive(location.pathname, c.to),
        );
        const parentActive = isPathActive(location.pathname, item.to, true);
        if (anyChildActive || parentActive) expanded[item.to] = true;
      }
    }
    return expanded;
  }, [sections, location.pathname]);

  const [expanded, setExpanded] = useState<Record<string, boolean>>(
    initialExpanded,
  );

  useEffect(() => {
    setExpanded((prev) => ({ ...initialExpanded, ...prev }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const toggle = (key: string) =>
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

  const renderLeaf = (item: NavItem, depth: number) => (
    <NavLink
      key={item.to}
      to={item.to}
      end={depth > 0}
      onClick={onNavigate}
      className={({ isActive }) =>
        `relative mb-0.5 flex items-center gap-2.5 rounded-sm py-2 text-body-sm transition ${
          depth > 0 ? 'pl-9 pr-2.5' : 'px-2.5'
        } ${
          isActive
            ? 'bg-surface font-medium text-text'
            : 'text-text hover:bg-surface'
        }`
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <span
              aria-hidden
              className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-r"
              style={{ background: accent.base }}
            />
          )}
          <item.icon size={15} />
          {item.label}
        </>
      )}
    </NavLink>
  );

  const renderParent = (item: NavItem) => {
    const children = item.children ?? [];
    const isOpen = expanded[item.to] ?? false;
    const parentActive = isPathActive(location.pathname, item.to, true);
    const childActive = children.some((c) =>
      isPathActive(location.pathname, c.to),
    );
    const highlight = parentActive || childActive;

    return (
      <div key={item.to} className="mb-0.5">
        <div
          className={`relative flex items-center rounded-sm transition ${
            highlight ? 'bg-surface' : 'hover:bg-surface'
          }`}
        >
          {highlight && (
            <span
              aria-hidden
              className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-r"
              style={{ background: accent.base }}
            />
          )}
          <NavLink
            to={item.to}
            end
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex flex-1 items-center gap-2.5 px-2.5 py-2 text-body-sm ${
                isActive ? 'font-medium text-text' : 'text-text'
              }`
            }
          >
            <item.icon size={15} />
            {item.label}
          </NavLink>
          <button
            type="button"
            aria-label={isOpen ? `Collapse ${item.label}` : `Expand ${item.label}`}
            aria-expanded={isOpen}
            onClick={() => toggle(item.to)}
            className="mr-1 flex h-7 w-7 items-center justify-center rounded-sm text-muted hover:bg-card hover:text-text"
          >
            <ChevronRight
              size={14}
              className={`transition-transform ${isOpen ? 'rotate-90' : ''}`}
            />
          </button>
        </div>
        {isOpen && (
          <div className="mt-0.5">
            {children.map((child) => renderLeaf(child, 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <div className="border-b border-border-default px-5 py-5">
        <p className="text-eyebrow uppercase text-muted">Ashara Mubaraka</p>
        <div className="mt-1 flex items-center gap-2">
          <span
            aria-hidden
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ background: accent.base }}
          />
          <p className="text-h3 text-text">
            {event.data?.year ?? 'Signage'}
          </p>
          {event.data?.hijri_year && (
            <p
              dir="rtl"
              lang="ar"
              className="font-arabic text-body-sm text-muted"
            >
              {event.data.hijri_year}
            </p>
          )}
        </div>
        {event.data?.city && (
          <p className="mt-0.5 text-meta text-muted">{event.data.city}</p>
        )}
      </div>
      {showSwitcher && (
        <div className="border-b border-border-default px-3 py-3">
          <EventSwitcher />
        </div>
      )}
      <nav className="flex-1 px-3 py-3">
        {sections.map((section) => (
          <div key={section.title} className="mb-4">
            <p className="px-2 pb-1 text-eyebrow uppercase text-hint">
              {section.title}
            </p>
            {section.items.map((item) =>
              item.children?.length ? renderParent(item) : renderLeaf(item, 0),
            )}
          </div>
        ))}
      </nav>
    </>
  );
};

export const Sidebar = () => (
  <aside className="sticky top-0 hidden h-screen w-[220px] shrink-0 flex-col gap-2 overflow-y-auto border-r border-border-default bg-card md:flex">
    <SidebarBody />
  </aside>
);

interface MobileSidebarProps {
  open: boolean;
  onClose: () => void;
}

export const MobileSidebar = ({ open, onClose }: MobileSidebarProps) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="Close menu"
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
      />
      <aside className="relative z-10 flex h-full w-[260px] max-w-[80vw] flex-col gap-2 overflow-y-auto border-r border-border-default bg-card shadow-lg">
        <SidebarBody onNavigate={onClose} showSwitcher />
      </aside>
    </div>
  );
};
