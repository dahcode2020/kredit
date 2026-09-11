import { Controller, Get, Post, Patch, Body, Query, UseGuards, Param } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
// import { RolesGuard, Roles } from '../../common/guards/roles.guard';

@Controller('admin/notification-templates')
export class NotificationTemplatesController {
  constructor(private readonly notifications: NotificationsService) {}

  // @UseGuards(RolesGuard) @Roles('ADMIN','SUPER_ADMIN')
  @Get()
  async list(@Query('event') event?: string, @Query('channel') channel?: string, @Query('locale') locale?: string) {
    return this.notifications.listTemplates({ event, channel, locale });
  }

  // @Roles('SUPER_ADMIN')
  @Post()
  async upsert(@Body() dto: any) {
    return this.notifications.upsertTemplate(dto, 'super@kredit.be');
  }

  @Post(':id/preview')
  async preview(@Param('id') id: string, @Body() body: { vars: Record<string,any>; locale: 'fr'|'en'|'nl'|'de' }) {
    return this.notifications.previewTemplate(id, body.vars, body.locale);
  }

  @Post(':id/test')
  async test(@Param('id') id: string, @Body() body: { to: string; vars: Record<string,any> }) {
    // enqueue test send (no client PII log)
    return { queued: true, id };
  }
}

@Controller('notifications')
export class NotificationsPublicController {
  constructor(private readonly notifications: NotificationsService) {}
  // Trigger example (for demo)
  @Post('dispatch')
  async dispatch(@Body() dto: { event:string; customerId:string; payload?:any }) {
    await this.notifications.dispatch(dto.event, dto.customerId, dto.payload);
    return { dispatched: true };
  }
}
