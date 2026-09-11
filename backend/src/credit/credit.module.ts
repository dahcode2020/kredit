import { Module } from '@nestjs/common';
import { CreditController } from './credit.controller';
import { CreditEngineService } from './credit-engine.service';
import { SimulationEngine } from './simulation/simulation.engine';
import { RulesService } from './rules/rules.service';
import { EligibilityEngine } from './eligibility/eligibility.engine';
import { ScoringEngine } from './scoring/scoring.engine';
import { DecisionEngine } from './decision-engine/decision.engine';
@Module({ controllers: [CreditController], providers: [CreditEngineService, SimulationEngine, RulesService, EligibilityEngine, ScoringEngine, DecisionEngine], exports: [CreditEngineService, RulesService] })
export class CreditModule {}
