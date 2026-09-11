import { Controller, Post, Body, UsePipes, ValidationPipe, HttpCode } from '@nestjs/common';
import { CreditEngineService } from './credit-engine.service';
import { SimulateDto } from './dto/simulate.dto';
@Controller('credit')
export class CreditController {
  constructor(private engine: CreditEngineService) {}
  @Post('simulations')
  @HttpCode(200)
  @UsePipes(new ValidationPipe({ whitelist:true, forbidNonWhitelisted:true, transform:true }))
  simulate(@Body() dto: SimulateDto) { return this.engine.simulate(dto as any); }
}
