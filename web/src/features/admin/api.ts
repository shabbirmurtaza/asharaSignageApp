/**
 * Super Admin API layer (PostgREST + RPC).
 * HTTP-only — no UI, no toast, no navigation.
 *
 * Row shapes mirror schema_v7.sql. We hand-maintain these because the
 * generated types/db.ts is the PostgREST OpenAPI shape and is overly
 * verbose; admin entities are stable.
 */

import { db } from '@/lib/api';
import type { RoleName } from '@/lib/auth';

// ============================================================
// Row shapes
// ============================================================

export interface EventRow {
  id: string;
  name: string;
  year: string;
  hijri_year: string | null;
  city: string | null;
  gregorian_year: number | null;
  notes: string | null;
  direction_colour: string | null;
  place_colour: string | null;
  notice_colour: string | null;
  brand_primary: string | null;
  is_archived: boolean;
  is_default: boolean;
  created_at?: string;
}

export type VenueType = 'fasal_city' | 'relay_city';

export interface VenueRow {
  id: string;
  name: string;
  type: VenueType;
  address: string | null;
  city: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  capacity: number | null;
  notes: string | null;
}

export interface ZoneRow {
  id: string;
  venue_id: string;
  name: string;
  is_cmz: boolean;
  notes: string | null;
}

export interface EventVenueRow {
  id: string;
  event_id: string;
  venue_id: string;
  venue?: VenueRow | null;
}

export interface DepartmentRow {
  id: string;
  name: string;
  name_lisan: string | null;
  hod_name: string | null;
  hod_contact: string | null;
  display_order: number | null;
}

export interface SizeRow {
  id: string;
  name: string | null;
  height: number;
  width: number;
  sqft: number;
}

export type UserStatus = 'pending_approval' | 'active' | 'rejected' | 'disabled';

export interface UserRow {
  id: string;
  its_number: string;
  name: string;
  email: string;
  contact_number: string | null;
  status: UserStatus;
  created_at?: string;
}

export interface AssignmentRow {
  id: string;
  user_id: string;
  role_id: string;
  event_id: string | null;
  venue_id: string | null;
  department_id: string | null;
  role?: { id: string; name: RoleName } | null;
  event?: { id: string; name: string } | null;
  venue?: { id: string; name: string } | null;
  department?: { id: string; name: string } | null;
}

export interface RoleRow {
  id: string;
  name: RoleName;
  label: string;
  description: string | null;
}

export interface SignupRequestRow {
  id: string;
  its_number: string;
  name: string;
  email: string;
  contact_number: string | null;
  requested_event_id: string | null;
  requested_venue_id: string | null;
  requested_department_id: string | null;
  status: 'pending' | 'approved' | 'rejected';
  rejection_note: string | null;
  created_at: string;
  event?: { id: string; name: string } | null;
  venue?: { id: string; name: string } | null;
  department?: { id: string; name: string } | null;
}

// ============================================================
// Events
// ============================================================

export const listEvents = (): Promise<EventRow[]> =>
  db.from<EventRow>('events').select('*', { order: 'created_at.desc' });

export const getEvent = async (id: string): Promise<EventRow> => {
  const rows = await db
    .from<EventRow>('events')
    .select('*', { id: `eq.${id}`, limit: '1' });
  if (rows.length === 0) throw new Error('Event not found');
  return rows[0];
};

export type EventInput = Omit<EventRow, 'id' | 'created_at'>;

export const createEvent = async (input: Partial<EventInput>): Promise<EventRow> => {
  const rows = await db.from<EventRow>('events').insert(input);
  return rows[0];
};

export const updateEvent = async (
  id: string,
  patch: Partial<EventInput>,
): Promise<EventRow> => {
  const rows = await db.from<EventRow>('events').update(patch, { id: `eq.${id}` });
  return rows[0];
};

/** Schema enforces single is_default via unique partial index — we clear others first. */
export const setDefaultEvent = async (id: string): Promise<void> => {
  await db
    .from<EventRow>('events')
    .update({ is_default: false }, { is_default: 'eq.true' });
  await db.from<EventRow>('events').update({ is_default: true }, { id: `eq.${id}` });
};

// ============================================================
// Event venues + zones
// ============================================================

export const listEventVenues = (eventId: string): Promise<EventVenueRow[]> =>
  db.from<EventVenueRow>('event_venues').select('*,venue:venues(*)', {
    event_id: `eq.${eventId}`,
  });

export const attachVenueToEvent = async (
  eventId: string,
  venueId: string,
): Promise<EventVenueRow> => {
  const rows = await db
    .from<EventVenueRow>('event_venues')
    .insert({ event_id: eventId, venue_id: venueId });
  return rows[0];
};

export const detachVenueFromEvent = (
  eventId: string,
  venueId: string,
): Promise<void> =>
  db.from<EventVenueRow>('event_venues').delete({
    event_id: `eq.${eventId}`,
    venue_id: `eq.${venueId}`,
  });

/** Toggle a zone as the CMZ. Trigger enforces fasal_city + uniqueness. */
export const setCmzZone = async (
  zoneId: string,
  venueId: string,
  enable: boolean,
): Promise<void> => {
  if (enable) {
    // Clear existing CMZ at this venue first (partial unique index would block).
    await db.from<ZoneRow>('zones').update(
      { is_cmz: false },
      { venue_id: `eq.${venueId}`, is_cmz: 'eq.true' },
    );
  }
  await db.from<ZoneRow>('zones').update({ is_cmz: enable }, { id: `eq.${zoneId}` });
};

// ============================================================
// Venues
// ============================================================

export const listVenues = (): Promise<VenueRow[]> =>
  db.from<VenueRow>('venues').select('*', { order: 'name.asc' });

export const createVenue = async (input: Partial<VenueRow>): Promise<VenueRow> => {
  const rows = await db.from<VenueRow>('venues').insert(input);
  return rows[0];
};

export const updateVenue = async (
  id: string,
  patch: Partial<VenueRow>,
): Promise<VenueRow> => {
  const rows = await db.from<VenueRow>('venues').update(patch, { id: `eq.${id}` });
  return rows[0];
};

export const deleteVenue = (id: string): Promise<void> =>
  db.from<VenueRow>('venues').delete({ id: `eq.${id}` });

// ---- Zones ----

export const listZones = (venueId: string): Promise<ZoneRow[]> =>
  db
    .from<ZoneRow>('zones')
    .select('*', { venue_id: `eq.${venueId}`, order: 'name.asc' });

export const createZone = async (input: Partial<ZoneRow>): Promise<ZoneRow> => {
  const rows = await db.from<ZoneRow>('zones').insert(input);
  return rows[0];
};

export const updateZone = async (
  id: string,
  patch: Partial<ZoneRow>,
): Promise<ZoneRow> => {
  const rows = await db.from<ZoneRow>('zones').update(patch, { id: `eq.${id}` });
  return rows[0];
};

export const deleteZone = (id: string): Promise<void> =>
  db.from<ZoneRow>('zones').delete({ id: `eq.${id}` });

// ============================================================
// Departments
// ============================================================

export const listDepartments = (): Promise<DepartmentRow[]> =>
  db.from<DepartmentRow>('departments').select('*', { order: 'name.asc' });

export const createDepartment = async (
  input: Partial<DepartmentRow>,
): Promise<DepartmentRow> => {
  const rows = await db.from<DepartmentRow>('departments').insert(input);
  return rows[0];
};

export const updateDepartment = async (
  id: string,
  patch: Partial<DepartmentRow>,
): Promise<DepartmentRow> => {
  const rows = await db
    .from<DepartmentRow>('departments')
    .update(patch, { id: `eq.${id}` });
  return rows[0];
};

export const deleteDepartment = (id: string): Promise<void> =>
  db.from<DepartmentRow>('departments').delete({ id: `eq.${id}` });

// ============================================================
// Sizes
// ============================================================

export const listSizes = (): Promise<SizeRow[]> =>
  db.from<SizeRow>('sizes').select('*', { order: 'sqft.asc' });

export const createSize = async (input: Partial<SizeRow>): Promise<SizeRow> => {
  const rows = await db.from<SizeRow>('sizes').insert(input);
  return rows[0];
};

export const updateSize = async (
  id: string,
  patch: Partial<SizeRow>,
): Promise<SizeRow> => {
  const rows = await db.from<SizeRow>('sizes').update(patch, { id: `eq.${id}` });
  return rows[0];
};

export const deleteSize = (id: string): Promise<void> =>
  db.from<SizeRow>('sizes').delete({ id: `eq.${id}` });

// ============================================================
// Roles (read-only reference)
// ============================================================

export const listRoles = (): Promise<RoleRow[]> =>
  db.from<RoleRow>('roles').select('*');

// ============================================================
// Users
// ============================================================

export interface UserListParams {
  eventId?: string | null;
}

export const listUsers = async (params?: UserListParams): Promise<UserRow[]> => {
  // Filter by event scope when present: returns users that have at least one
  // assignment in the given event. We do this server-side by inner-joining
  // user_role_assignments via PostgREST embed and filtering on the embed.
  if (params?.eventId) {
    // Use embed filter syntax: `user_role_assignments!inner(event_id)` plus
    // top-level filter `user_role_assignments.event_id=eq.<id>`.
    return db.from<UserRow>('users').select(
      '*,user_role_assignments!inner(event_id)',
      {
        'user_role_assignments.event_id': `eq.${params.eventId}`,
        order: 'created_at.desc',
      },
    );
  }
  return db.from<UserRow>('users').select('*', { order: 'created_at.desc' });
};

export const getUser = async (id: string): Promise<UserRow> => {
  const rows = await db
    .from<UserRow>('users')
    .select('*', { id: `eq.${id}`, limit: '1' });
  if (rows.length === 0) throw new Error('User not found');
  return rows[0];
};

export const listAssignments = (userId: string): Promise<AssignmentRow[]> =>
  db
    .from<AssignmentRow>('user_role_assignments')
    .select(
      '*,role:roles(id,name),event:events(id,name),venue:venues(id,name),department:departments(id,name)',
      { user_id: `eq.${userId}` },
    );

export interface AddAssignmentInput {
  user_id: string;
  role_id: string;
  event_id: string | null;
  venue_id: string | null;
  department_id: string | null;
}

export const addAssignment = async (
  input: AddAssignmentInput,
): Promise<AssignmentRow> => {
  const rows = await db.from<AssignmentRow>('user_role_assignments').insert(input);
  return rows[0];
};

export const removeAssignment = (id: string): Promise<void> =>
  db.from<AssignmentRow>('user_role_assignments').delete({ id: `eq.${id}` });

export const disableUser = (userId: string): Promise<void> =>
  db.rpc('disable_user', { p_user_id: userId });

export const enableUser = (userId: string): Promise<void> =>
  db.rpc('enable_user', { p_user_id: userId });

export const adminResetPassword = (
  userId: string,
  newPassword: string,
): Promise<void> =>
  db.rpc('admin_reset_password', {
    p_user_id: userId,
    p_new_password: newPassword,
  });

// ============================================================
// Signup requests
// ============================================================

export const listPendingSignups = (): Promise<SignupRequestRow[]> =>
  db
    .from<SignupRequestRow>('signup_requests')
    .select(
      '*,event:events!signup_requests_requested_event_id_fkey(id,name),venue:venues!signup_requests_requested_venue_id_fkey(id,name),department:departments!signup_requests_requested_department_id_fkey(id,name)',
      { status: 'eq.pending', order: 'created_at.desc' },
    );

export const getSignupRequest = async (
  id: string,
): Promise<SignupRequestRow> => {
  const rows = await db
    .from<SignupRequestRow>('signup_requests')
    .select(
      '*,event:events!signup_requests_requested_event_id_fkey(id,name),venue:venues!signup_requests_requested_venue_id_fkey(id,name),department:departments!signup_requests_requested_department_id_fkey(id,name)',
      { id: `eq.${id}`, limit: '1' },
    );
  if (rows.length === 0) throw new Error('Signup request not found');
  return rows[0];
};

export const approveSignup = (
  reqId: string,
  role: RoleName,
): Promise<string> =>
  db.rpc<string>('approve_signup', {
    p_request_id: reqId,
    p_role_name: role,
  });

export const rejectSignup = (reqId: string, note: string): Promise<void> =>
  db.rpc('reject_signup', { p_request_id: reqId, p_note: note });
