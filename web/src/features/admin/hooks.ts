import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { RoleName } from '@/lib/auth';
import {
  addAssignment,
  adminResetPassword,
  approveSignup,
  attachVenueToEvent,
  createDepartment,
  createEvent,
  createSize,
  createVenue,
  createZone,
  deleteDepartment,
  deleteSize,
  deleteVenue,
  deleteZone,
  detachVenueFromEvent,
  disableUser,
  enableUser,
  getEvent,
  getSignupRequest,
  getUser,
  listAssignments,
  listDepartments,
  listEventVenues,
  listEvents,
  listPendingSignups,
  listRoles,
  listSizes,
  listUsers,
  listVenues,
  listZones,
  rejectSignup,
  removeAssignment,
  setCmzZone,
  setDefaultEvent,
  updateDepartment,
  updateEvent,
  updateSize,
  updateVenue,
  updateZone,
  type AddAssignmentInput,
  type DepartmentRow,
  type EventRow,
  type SizeRow,
  type VenueRow,
  type ZoneRow,
} from './api';

const KEYS = {
  events: ['admin', 'events'] as const,
  event: (id: string) => ['admin', 'event', id] as const,
  eventVenues: (id: string) => ['admin', 'event', id, 'venues'] as const,
  venues: ['admin', 'venues'] as const,
  zones: (venueId: string) => ['admin', 'zones', venueId] as const,
  departments: ['admin', 'departments'] as const,
  sizes: ['admin', 'sizes'] as const,
  users: (eventId: string | null | undefined) =>
    ['admin', 'users', eventId ?? 'all'] as const,
  user: (id: string) => ['admin', 'user', id] as const,
  assignments: (userId: string) => ['admin', 'assignments', userId] as const,
  roles: ['admin', 'roles'] as const,
  signups: ['admin', 'signups'] as const,
  signup: (id: string) => ['admin', 'signup', id] as const,
};

// ---------- Events ----------
export const useEvents = () =>
  useQuery({ queryKey: KEYS.events, queryFn: listEvents });

export const useEvent = (id: string | undefined) =>
  useQuery({
    queryKey: KEYS.event(id ?? ''),
    queryFn: () => getEvent(id as string),
    enabled: !!id,
  });

export const useCreateEvent = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<EventRow>) => createEvent(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'events'] }),
  });
};

export const useUpdateEvent = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<EventRow> }) =>
      updateEvent(id, patch),
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: ['admin', 'events'] });
      qc.invalidateQueries({ queryKey: KEYS.event(row.id) });
    },
  });
};

export const useSetDefaultEvent = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => setDefaultEvent(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'events'] }),
  });
};

// ---------- Event venues + zones ----------
export const useEventVenues = (eventId: string | undefined) =>
  useQuery({
    queryKey: KEYS.eventVenues(eventId ?? ''),
    queryFn: () => listEventVenues(eventId as string),
    enabled: !!eventId,
  });

export const useAttachVenueToEvent = (eventId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (venueId: string) => attachVenueToEvent(eventId, venueId),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: KEYS.eventVenues(eventId) }),
  });
};

export const useDetachVenueFromEvent = (eventId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (venueId: string) => detachVenueFromEvent(eventId, venueId),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: KEYS.eventVenues(eventId) }),
  });
};

export const useSetCmzZone = (venueId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ zoneId, enable }: { zoneId: string; enable: boolean }) =>
      setCmzZone(zoneId, venueId, enable),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.zones(venueId) }),
  });
};

// ---------- Venues ----------
export const useVenues = () =>
  useQuery({ queryKey: KEYS.venues, queryFn: listVenues });

export const useCreateVenue = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<VenueRow>) => createVenue(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.venues }),
  });
};

export const useUpdateVenue = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<VenueRow> }) =>
      updateVenue(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.venues }),
  });
};

export const useDeleteVenue = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteVenue(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.venues }),
  });
};

// ---------- Zones ----------
export const useZones = (venueId: string | undefined) =>
  useQuery({
    queryKey: KEYS.zones(venueId ?? ''),
    queryFn: () => listZones(venueId as string),
    enabled: !!venueId,
  });

export const useCreateZone = (venueId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<ZoneRow>) =>
      createZone({ ...input, venue_id: venueId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.zones(venueId) }),
  });
};

export const useUpdateZone = (venueId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<ZoneRow> }) =>
      updateZone(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.zones(venueId) }),
  });
};

export const useDeleteZone = (venueId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteZone(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.zones(venueId) }),
  });
};

// ---------- Departments ----------
export const useDepartments = () =>
  useQuery({ queryKey: KEYS.departments, queryFn: listDepartments });

export const useCreateDepartment = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<DepartmentRow>) => createDepartment(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.departments }),
  });
};

export const useUpdateDepartment = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: string;
      patch: Partial<DepartmentRow>;
    }) => updateDepartment(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.departments }),
  });
};

export const useDeleteDepartment = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteDepartment(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.departments }),
  });
};

// ---------- Sizes ----------
export const useSizes = () =>
  useQuery({ queryKey: KEYS.sizes, queryFn: listSizes });

export const useCreateSize = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<SizeRow>) => createSize(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.sizes }),
  });
};

export const useUpdateSize = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<SizeRow> }) =>
      updateSize(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.sizes }),
  });
};

export const useDeleteSize = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteSize(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.sizes }),
  });
};

// ---------- Users ----------
export const useUsers = (eventId: string | null | undefined) =>
  useQuery({
    queryKey: KEYS.users(eventId),
    queryFn: () => listUsers({ eventId: eventId ?? null }),
  });

export const useUser = (id: string | undefined) =>
  useQuery({
    queryKey: KEYS.user(id ?? ''),
    queryFn: () => getUser(id as string),
    enabled: !!id,
  });

export const useAssignments = (userId: string | undefined) =>
  useQuery({
    queryKey: KEYS.assignments(userId ?? ''),
    queryFn: () => listAssignments(userId as string),
    enabled: !!userId,
  });

export const useAddAssignment = (userId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AddAssignmentInput) => addAssignment(input),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: KEYS.assignments(userId) }),
  });
};

export const useRemoveAssignment = (userId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => removeAssignment(id),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: KEYS.assignments(userId) }),
  });
};

export const useDisableUser = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => disableUser(userId),
    onSuccess: (_v, userId) => {
      qc.invalidateQueries({ queryKey: ['admin', 'users'] });
      qc.invalidateQueries({ queryKey: KEYS.user(userId) });
    },
  });
};

export const useEnableUser = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => enableUser(userId),
    onSuccess: (_v, userId) => {
      qc.invalidateQueries({ queryKey: ['admin', 'users'] });
      qc.invalidateQueries({ queryKey: KEYS.user(userId) });
    },
  });
};

export const useAdminResetPassword = () =>
  useMutation({
    mutationFn: ({
      userId,
      newPassword,
    }: {
      userId: string;
      newPassword: string;
    }) => adminResetPassword(userId, newPassword),
  });

// ---------- Roles ----------
export const useRoles = () =>
  useQuery({ queryKey: KEYS.roles, queryFn: listRoles });

// ---------- Signup requests ----------
export const usePendingSignups = () =>
  useQuery({ queryKey: KEYS.signups, queryFn: listPendingSignups });

export const useSignupRequest = (id: string | undefined) =>
  useQuery({
    queryKey: KEYS.signup(id ?? ''),
    queryFn: () => getSignupRequest(id as string),
    enabled: !!id,
  });

export const useApproveSignup = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ reqId, role }: { reqId: string; role: RoleName }) =>
      approveSignup(reqId, role),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.signups });
      qc.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });
};

export const useRejectSignup = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ reqId, note }: { reqId: string; note: string }) =>
      rejectSignup(reqId, note),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.signups }),
  });
};
