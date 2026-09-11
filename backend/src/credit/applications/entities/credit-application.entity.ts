import { ApplicationStatus } from '../workflow/application-status.enum';

export interface CreditApplication {
  id: string;
  customerId: string;
  productId: string;
  country: string; // BE
  amount: number;
  termMonths: number;
  status: ApplicationStatus;
  currentStep: number; // 1..17
  simulationSnapshot: any | null;
  eligibilitySnapshot: any | null;
  scoringSnapshot: any | null;
  recommendation: string | null; // APPROVE/REVIEW/REJECT
  exceptionReason: string | null;
  decidedBy: string | null;
  decidedAt: string | null;
  contractRef: string | null;
  pspRef: string | null;
  createdAt: string;
  updatedAt: string;
}

export const CREATE_APPLICATIONS_TABLE_SQL = `
CREATE TYPE application_status AS ENUM (
  'DRAFT','SUBMITTED','KYC_PENDING','DOCUMENTS_PENDING',
  'UNDER_AUTOMATED_REVIEW','UNDER_ADMIN_REVIEW','MORE_INFORMATION_REQUIRED',
  'APPROVED','APPROVED_WITH_EXCEPTION','REJECTED',
  'CONTRACT_PENDING','CONTRACT_SIGNED','DISBURSEMENT_PENDING','DISBURSED','CLOSED','CANCELLED'
);
CREATE TABLE IF NOT EXISTS credit_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES users(id),
  product_id UUID REFERENCES products(id),
  country CHAR(2) NOT NULL DEFAULT 'BE',
  amount NUMERIC(15,2) NOT NULL,
  term_months INT NOT NULL,
  status application_status NOT NULL DEFAULT 'DRAFT',
  current_step INT DEFAULT 1,
  simulation_snapshot JSONB,
  eligibility_snapshot JSONB,
  scoring_snapshot JSONB,
  recommendation TEXT,
  exception_reason TEXT,
  decided_by UUID REFERENCES users(id),
  decided_at TIMESTAMPTZ,
  contract_ref TEXT,
  psp_ref TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
`;
