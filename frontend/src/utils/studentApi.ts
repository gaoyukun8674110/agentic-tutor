import { apiFetch, type ApiRequestOptions } from './apiClient';

export type TodayPlanReason = 'due_review' | 'zpd' | 'unlocked' | string;

export interface TodayPlanAction {
  type: 'training' | 'feynman' | string;
  target_skills?: string[];
  skill_id?: string;
}

export interface TodayPlanItem {
  skill_id: string;
  skill_name: string;
  reason: TodayPlanReason;
  effective_mastery: number;
  days_since_practice: number | null;
  prerequisites_ready: boolean;
  suggested_minutes: number;
  action: TodayPlanAction;
}

export interface TodayPlan {
  user_id: string;
  generated_at: string | null;
  items: TodayPlanItem[];
  empty_reason: 'no_skills' | 'all_mastered' | null;
}

export interface SkillMastery {
  skill_id: string;
  skill_name: string;
  mastery_score: number;
  total_attempts: number;
  total_correct: number;
  recent_correct_rate: number;
}

export interface MasteryResponse {
  user_id: string;
  masteries: SkillMastery[];
}

export async function fetchTodayPlan(
  username: string,
  limit = 3,
  options?: ApiRequestOptions,
): Promise<TodayPlan> {
  const params = new URLSearchParams({ limit: String(limit) });
  return apiFetch<TodayPlan>(
    `/api/student/${encodeURIComponent(username)}/today-plan?${params.toString()}`,
    options,
  );
}

export async function fetchMastery(
  username: string,
  options?: ApiRequestOptions,
): Promise<MasteryResponse> {
  return apiFetch<MasteryResponse>(`/api/student/${encodeURIComponent(username)}/mastery`, options);
}
