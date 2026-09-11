import { Controller, Get, Put, Param, Body, Req, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@ApiTags('Notifications')
@ApiBearerAuth('bearer')
@Controller('notifications')
export class NotificationsApiController {
  @Get()
  @ApiOperation({ summary: 'Mes notifications' })
  async list(@Query('unread') _u?: string, @Query('page') page = 1, @Query('limit') limit = 20) {
    return { data: [{ id: 'notif_1', channel: 'EMAIL', title: 'Dossier approuvé', body: '...', read: false, created_at: new Date().toISOString() }], meta: { total: 1, page: Number(page), limit: Number(limit) } };
  }

  @Put(':id/read')
  @ApiOperation({ summary: 'Marquer lue', description: 'Idempotence' })
  async markRead(@Param('id') id: string, @Body() body: { read: boolean }) {
    return { id, read: body.read };
  }
}
