export interface Speaker {
  id: number;
  name: string;
  profile_url: string | null;
  photo_url: string | null;
}

export interface Session {
  id: number;
  code: string;
  title: string;
  description: string | null;
  type: string | null;
  level: number | null;
  category: string | null;
  modality: string | null;
  is_recorded: boolean;
  session_url: string | null;
  is_favorite: boolean;
  prio: Prio;
  why: string | null;
  created_at: string;
  updated_at: string;
  speakers: Speaker[];
}

export type Prio = 'must' | 'high' | 'good' | 'skip';

export interface SessionFilters {
  prio: string;
  type: string;
  category: string;
  recorded: string;
  search: string;
  sort: string;
  direction: 'asc' | 'desc';
}

export interface SyncResult {
  inserted: number;
  updated: number;
  total: number;
  errors: string[];
}