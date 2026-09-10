import { Controller, Post, Body } from '@nestjs/common';
import { SimulationService } from './simulation.service';
@Controller('simulations')
export class SimulationController {
  constructor(private svc: SimulationService) {}
  @Post()
  simulate(@Body() dto: any) {
    return this.svc.simulate(dto);
  }
}
