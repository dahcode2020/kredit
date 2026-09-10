import { Module } from "@nestjs/common";
import { ProductsModule } from "./products/products.module";
import { RulesModule } from "./rules/rules.module";
import { SimulationModule } from "./simulation/simulation.module";
@Module({ imports: [ProductsModule, RulesModule, SimulationModule] })
export class CreditModule {}
