import { Controller, Post, Get, Body, Param, Query } from '@nestjs/common';
import { AppService } from './app.service';
import { IsString, IsInt, Min, IsOptional, IsNumber, Max } from 'class-validator';

class CreateActivityDto {
  @IsString()
  phoneNumber: string;

  @IsString()
  activityName: string;

  @IsString()
  @IsOptional()
  description: string;

  @IsInt()
  @Min(1)
  intervalMinutes: number; // 报平安间隔

  @IsString()
  contactPhone: string;

  @IsString()
  @IsOptional()
  contactEmail: string;

  @IsString()
  @IsOptional()
  secondaryContactPhone: string;

  @IsString()
  @IsOptional()
  secondaryContactEmail: string;

  @IsString()
  @IsOptional()
  emergencyInstructions: string;

  @IsInt()
  @IsOptional()
  warningMinutes: number;

  @IsNumber()
  @IsOptional()
  lastLatitude?: number;

  @IsNumber()
  @IsOptional()
  lastLongitude?: number;
}

class ReportSafeDto {
  @IsNumber()
  @IsOptional()
  lat?: number;

  @IsNumber()
  @IsOptional()
  lng?: number;

  @IsInt()
  @Min(0)
  @Max(100)
  @IsOptional()
  batteryLevel?: number;
}

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Post('activity')
  async startActivity(@Body() body: CreateActivityDto) {
    return this.appService.startActivity(
      body.phoneNumber,
      body.activityName,
      body.description || '',
      body.intervalMinutes,
      body.contactPhone,
      body.contactEmail || '',
      body.warningMinutes,
      body.lastLatitude,
      body.lastLongitude,
      body.secondaryContactPhone || '',
      body.secondaryContactEmail || '',
      body.emergencyInstructions || '',
    );
  }

  @Get('activity/current')
  async getCurrentActivity(@Query('phoneNumber') phoneNumber: string) {
      return this.appService.getCurrentActivity(phoneNumber);
  }

  @Post('activity/:id/safe')
  async reportSafe(@Param('id') id: string, @Body() body: ReportSafeDto) {
    return this.appService.reportSafe(id, body.lat, body.lng, body.batteryLevel);
  }

  @Post('activity/:id/end')
  async endActivity(@Param('id') id: string) {
    return this.appService.endActivity(id);
  }

  @Post('test-connection')
  async testConnection(@Body() body: any) {
    return this.appService.testConnection(body.email, body.lat, body.lng);
  }
}
