import { supabase, backendReady } from './supabase';

export type Ticket = { id: string; status: string; category: string; severity: string; description: string; lat: number; lng: number; location_text: string; road_name: string | null; maintainer: string; district_id: number | null; duplicate_of: string | null; submitted_to_county_at: string | null; county_reference: string | null; fixed_at: string | null; closed_at: string | null; created_at: string; updated_at: string; photo_count: number };
export type TicketEvent = { id: number; ticket_id: string; actor: string; kind: string; from_status: string | null; to_status: string | null; note: string | null; created_at: string };
export type TicketPhoto = { id: string; ticket_id: string; event_id: number | null; public_path: string; width: number; height: number; taken_at: string | null; caption: string | null; created_at: string };
export type Idea = { id: number; title: string; body: string; category: string; status: string; status_note: string | null; vote_count: number; created_at: string; updated_at: string };
export type Commitment = { id: number; member_id: string; origin: 'campaign' | 'in_office'; election_id: string | null; meeting_id: string | null; made_on: string; quote: string; summary: string; category: string[] | null; scoreable: boolean; wording_type: 'effort' | 'outcome'; measure: string | null; deadline: string | null; within_authority: boolean; authority_note: string | null; created_at: string; current_rating: string | null; proposed_rating: string | null };
export type Score = { member_id: string; full_name: string; role: string; district_id: number | null; scoreable_total: number; kept: number; compromise: number; broken: number; pending: number; resolved: number; score: number | null; ranked: boolean };

// deno-lint-ignore no-explicit-any
const safe = async <T,>(fn: () => PromiseLike<{ data: any; error: { message: string } | null }>, fallback: T): Promise<T> => {
  if (!backendReady) return fallback;
  try { const { data, error } = await fn(); if (error) throw new Error(error.message); return (data ?? fallback) as T; } catch (e) { console.warn('api', (e as Error).message); return fallback; }
};

export const api = {
  tickets: (opts: { status?: string[]; limit?: number } = {}) => safe<Ticket[]>(async () => { let q = supabase().from('tickets_public').select('*').order('created_at', { ascending: false }).limit(opts.limit ?? 500); if (opts.status?.length) q = q.in('status', opts.status); return q; }, []),
  ticket: (id: string) => safe<Ticket | null>(() => supabase().from('tickets_public').select('*').eq('id', id).maybeSingle(), null),
  ticketEvents: (id: string) => safe<TicketEvent[]>(() => supabase().from('ticket_events_public').select('*').eq('ticket_id', id).order('created_at'), []),
  ticketPhotos: (id: string) => safe<TicketPhoto[]>(() => supabase().from('ticket_photos_public').select('*').eq('ticket_id', id).order('created_at'), []),
  geojson: (statuses?: string[]) => safe<GeoJSON.FeatureCollection>(() => supabase().rpc('tickets_geojson', { statuses: statuses ?? null }), { type: 'FeatureCollection', features: [] }),
  nearby: (lat: number, lng: number) => safe<Ticket[]>(() => supabase().rpc('nearby_tickets', { lat, lng, meters: 75, days: 90 }), []),
  districtStats: () => safe<{ district_id: number; name: string; open_tickets: number; fixed_tickets: number; total_tickets: number; median_days_to_fix: number | null }[]>(() => supabase().from('district_ticket_stats').select('*').order('district_id'), []),
  ideas: () => safe<Idea[]>(() => supabase().from('ideas_public').select('*').order('vote_count', { ascending: false }).order('created_at', { ascending: false }), []),
  idea: (id: number) => safe<Idea | null>(() => supabase().from('ideas_public').select('*').eq('id', id).maybeSingle(), null),
  ideaComments: (id: number) => safe<{ id: number; actor: string; body: string; created_at: string }[]>(() => supabase().from('idea_comments_public').select('*').eq('idea_id', id).order('created_at'), []),
  corrections: () => safe<{ id: number; record_table: string; record_id: string; message: string; resolution: string | null; resolved_at: string; created_at: string }[]>(() => supabase().from('corrections_log').select('*').order('resolved_at', { ascending: false }), []),
  commitments: (memberId?: string) => safe<Commitment[]>(async () => { let q = supabase().from('commitments_public').select('*').order('made_on', { ascending: false }); if (memberId) q = q.eq('member_id', memberId); return q; }, []),
  commitment: (id: number) => safe<Commitment | null>(() => supabase().from('commitments_public').select('*').eq('id', id).maybeSingle(), null),
  commitmentDetail: async (id: number) => {
    const [ratings, sources, evidence, responses] = await Promise.all([
      safe<{ id: number; rating: string; state: string; reason: string; proposed_at: string; effective_at: string; second_reviewed: boolean }[]>(() => supabase().from('commitment_ratings_public').select('*').eq('commitment_id', id).order('proposed_at', { ascending: false }), []),
      safe<{ id: number; kind: string; url: string | null; archive_url: string | null; snapshot_path: string | null; media_timestamp: string | null; captured_at: string }[]>(() => supabase().from('commitment_sources_public').select('*').eq('commitment_id', id), []),
      safe<{ id: number; motion_id: string | null; budget_line_id: string | null; document_id: string | null; note: string | null }[]>(() => supabase().from('commitment_evidence_public').select('*').eq('commitment_id', id), []),
      safe<{ id: number; member_id: string; body: string; received_via: string; created_at: string }[]>(() => supabase().from('official_responses_public').select('*').eq('commitment_id', id).order('created_at'), []),
    ]);
    return { ratings, sources, evidence, responses };
  },
  scores: () => safe<Score[]>(() => supabase().from('commitment_scores').select('*'), []),
  status: () => safe<{ tickets: number; photos_pending: number; ideas: number; flags_open: number; commitments: number; last_publish: string | null } | null>(() => supabase().from('hub_status').select('*').maybeSingle(), null),
};
