import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { ApplicationStatus, TERMINAL_STATUSES } from './application-status.enum';
import { ALLOWED_TRANSITIONS, findTransition, ActorRole } from './application-workflow';

export interface TransitionInput {
  applicationId: string;
  from: ApplicationStatus;
  to: ApplicationStatus;
  actorId: string | null;
  actorRole: ActorRole;
  amount: number; // pour seuil exception
  reason?: string | null;
  exceptionReason?: string | null;
  history: ApplicationStatus[]; // historique complet pour garde anti-contournement
  metadata?: Record<string, any>;
}

export interface TransitionResult {
  from: ApplicationStatus;
  to: ApplicationStatus;
  event: string;
  auditAction: string;
  historyRow: {
    applicationId: string;
    fromStatus: ApplicationStatus;
    toStatus: ApplicationStatus;
    actorId: string | null;
    actorRole: ActorRole;
    reason: string | null;
    metadata: Record<string, any> | null;
  };
  auditLog: {
    actorId: string | null;
    actorRole: ActorRole;
    action: string;
    entity: string;
    entityId: string;
    before: any;
    after: any;
    reason: string | null;
  };
}

@Injectable()
export class ApplicationWorkflowService {
  /**
   * Valide et construit la transition — ne touche pas la DB (appelant doit faire transaction: UPDATE + INSERT history + INSERT audit + publish event)
   */
  transition(input: TransitionInput): TransitionResult {
    const { from, to, actorRole, amount, reason, exceptionReason, history } = input;

    if (TERMINAL_STATUSES.has(from)) {
      throw new BadRequestException({ code: 'TRANSITION_FROM_TERMINAL', message: `Aucune transition depuis ${from} (terminal)` });
    }

    const def = findTransition(from, to);
    if (!def) {
      throw new BadRequestException({ code: 'TRANSITION_NOT_ALLOWED', message: `Transition ${from} → ${to} interdite` });
    }

    if (!def.allowedRoles.includes(actorRole)) {
      throw new ForbiddenException({ code: 'TRANSITION_FORBIDDEN_ROLE', message: `Rôle ${actorRole} non autorisé pour ${from}→${to}` });
    }

    if (def.requiresReason && !reason?.trim()) {
      throw new BadRequestException({ code: 'MISSING_REASON', message: `Motif obligatoire pour ${from}→${to}` });
    }

    if (def.requiresExceptionReason && !exceptionReason?.trim()) {
      throw new BadRequestException({ code: 'MISSING_EXCEPTION_REASON', message: `Motif d'exception obligatoire pour APPROVED_WITH_EXCEPTION (20-2000 chars)` });
    }
    if (def.requiresExceptionReason && exceptionReason && (exceptionReason.trim().length < 20 || exceptionReason.trim().length > 2000)) {
      throw new BadRequestException({ code: 'INVALID_EXCEPTION_REASON', message: `exceptionReason doit faire 20-2000 chars` });
    }

    if (def.requiresSuperAdminIfAmountOver && amount > def.requiresSuperAdminIfAmountOver && actorRole !== 'SUPER_ADMIN') {
      throw new ForbiddenException({ code: 'REQUIRES_SUPER_ADMIN', message: `Montant ${amount} > seuil ${def.requiresSuperAdminIfAmountOver} — SUPER_ADMIN requis pour exception` });
    }

    // Garde anti-contournement: UNDER_AUTOMATED_REVIEW exige avoir vu KYC_PENDING et DOCUMENTS_PENDING
    if (to === ApplicationStatus.UNDER_AUTOMATED_REVIEW) {
      if (!history.includes(ApplicationStatus.KYC_PENDING) || !history.includes(ApplicationStatus.DOCUMENTS_PENDING)) {
        throw new BadRequestException({ code: 'BYPASS_DETECTED', message: `Contournement détecté: KYC_PENDING et DOCUMENTS_PENDING requis avant ${to}` });
      }
    }
    if (to === ApplicationStatus.UNDER_ADMIN_REVIEW && !history.includes(ApplicationStatus.UNDER_AUTOMATED_REVIEW)) {
      throw new BadRequestException({ code: 'BYPASS_DETECTED', message: `UNDER_AUTOMATED_REVIEW requis avant UNDER_ADMIN_REVIEW` });
    }
    if ([ApplicationStatus.APPROVED, ApplicationStatus.APPROVED_WITH_EXCEPTION, ApplicationStatus.REJECTED].includes(to) && from !== ApplicationStatus.UNDER_ADMIN_REVIEW && !(from === ApplicationStatus.KYC_PENDING && to === ApplicationStatus.REJECTED)) {
      // seul KPI hard KYC peut rejeter, sinon passe par ADMIN
      throw new BadRequestException({ code: 'BYPASS_DETECTED', message: `Décision finale seulement depuis UNDER_ADMIN_REVIEW (ou KYC hard)` });
    }

    const effectiveReason = def.requiresExceptionReason ? exceptionReason!.trim() : (reason?.trim() || null);

    return {
      from, to,
      event: def.event,
      auditAction: def.auditAction,
      historyRow: {
        applicationId: input.applicationId,
        fromStatus: from,
        toStatus: to,
        actorId: input.actorId,
        actorRole,
        reason: effectiveReason,
        metadata: input.metadata ?? null,
      },
      auditLog: {
        actorId: input.actorId,
        actorRole,
        action: def.auditAction,
        entity: 'credit_application',
        entityId: input.applicationId,
        before: { status: from },
        after: { status: to, exceptionReason: effectiveReason },
        reason: effectiveReason,
      },
    };
  }
}
