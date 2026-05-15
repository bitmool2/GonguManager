import {
  Controller,
  Get,
  Put,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PaymentsService } from './payments.service';
import * as ExcelJS from 'exceljs';

@ApiTags('Payments')
@Controller('payments')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PaymentsController {
  constructor(private paymentsService: PaymentsService) {}

  @Get()
  @ApiOperation({ summary: '입금 목록 조회' })
  async findAll(
    @CurrentUser() user: any,
    @Query('status') status?: string,
    @Query('projectId') projectId?: number,
  ) {
    return this.paymentsService.findAll(BigInt(user.id), status, projectId);
  }

  @Get('summary')
  @ApiOperation({ summary: '입금 요약' })
  async getSummary(
    @CurrentUser() user: any,
    @Query('projectId') projectId?: number,
  ) {
    return this.paymentsService.getSummary(BigInt(user.id), projectId);
  }

  @Put(':id/confirm')
  @ApiOperation({ summary: '입금 완료 처리' })
  async confirm(@Param('id') id: string, @CurrentUser() user: any) {
    return this.paymentsService.confirmPayment(BigInt(id), BigInt(user.id));
  }

  @Put(':id/match')
  @ApiOperation({ summary: '수동 매칭' })
  async manualMatch(
    @Param('id') id: string,
    @Body('depositorName') depositorName: string,
    @CurrentUser() user: any,
  ) {
    return this.paymentsService.manualMatch(
      BigInt(id),
      BigInt(user.id),
      depositorName,
    );
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: '입금내역 업로드' })
  async upload(@UploadedFile() file: Express.Multer.File, @CurrentUser() user: any) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(Buffer.from(file.buffer) as any);
    const sheet = workbook.worksheets[0];
    const records: { depositorName: string; amount: number }[] = [];

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // header skip
      const depositorName = row.getCell(1).text;
      const amount = Number(row.getCell(2).value);
      if (depositorName && amount) {
        records.push({ depositorName, amount });
      }
    });

    return this.paymentsService.uploadPayments(BigInt(user.id), records);
  }
}
