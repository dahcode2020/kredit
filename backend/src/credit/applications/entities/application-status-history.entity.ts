/**
 * credit_application_status_history — append-only
 * Chaque transition enregistrée dans même transaction que UPDATE applications.status
 */
// TypeORM entity (pseudo, sans décorateurs pour MVP)
export interface ApplicationStatusHistoryRow {
  id: string; // BIGSERIAL
  applicationId: string;
  fromStatus: string;
  toStatus: string;
  actorId: string | null; // null si SYSTEM
  actorRole: string;
  reason: string | null; // obligatoire si EXCEPTION / REJECT / MORE_INFO
  metadata: Record<string, any> | null; // {recommendation, score, debtRatio, exceptionThreshold, pspRef, ...}
  createdAt: string;
}

export const CREATE_HISTORY_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS credit_application_status_history (
  id BIGSERIAL PRIMARY KEY,
  application_id UUID NOT NULL REFERENCES credit_applications(id),
  from_status TEXT NOT NULL,
  to_status TEXT NOT NULL,
  actor_id UUID REFERENCES users(id),
  actor_role TEXT NOT NULL,
  reason TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_hist_app ON credit_application_status_history(application_id, created_at);
-- INSERT only: REVOKE UPDATE,DELETE ON credit_application_status_history FROM app_role;
`;
