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
  prio: 'must' | 'high' | 'good' | 'skip';
  why: string | null;
  created_at: string;
  updated_at: string;
  speakers?: Speaker[];
}

export interface Speaker {
  id: number;
  name: string;
  profile_url: string | null;
  photo_url: string | null;
}

export interface SessionFilters {
  type?: string;
  category?: string;
  prio?: string;
  recorded?: string;
  search?: string;
  sort?: string;
  direction?: 'asc' | 'desc';
}

export interface ScrapedSession {
  code: string;
  title: string;
  description: string;
  type: string;
  level: number | null;
  category: string;
  modality: string;
  is_recorded: boolean;
  session_url: string;
  speakers: ScrapedSpeaker[];
}

export interface ScrapedSpeaker {
  name: string;
  profile_url: string;
  photo_url: string;
}

export interface SyncResult {
  inserted: number;
  updated: number;
  total: number;
  errors: string[];
}