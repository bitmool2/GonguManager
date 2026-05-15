import {
  Controller,
  Get,
  Put,
  Post,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PaymentsService } from './payments.service';
import * as XLSX from 'xlsx';

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
    if (!file) throw new BadRequestException('파일이 없습니다.');

    const workbook = XLSX.read(file.buffer, { type: 'buffer' });
    const sheet    = workbook.Sheets[workbook.SheetNames[0]];
    const rows     = XLSX.utils.sheet_to_json<any>(sheet, { header: 1, defval: '' });

    if (rows.length < 2) {
      throw new BadRequestException('데이터가 없습니다. 파일을 확인하세요.');
    }

    // ── 헤더 행 탐색: 최대 10행 안에서 입금자/금액 컬럼이 모두 있는 행을 찾음
    const NAME_KEYWORDS   = ['입금자명', '입금자', '성명', '입금자성명', '이름', '보내는분'];
    const AMOUNT_KEYWORDS = ['입금금액', '입금액', '거래금액', '거래액', '보내는금액', '금액'];
    // 잔액류 컬럼은 금액 탐색에서 제외
    const BALANCE_KEYWORDS = ['잔액', '거래후금액', '잔고', '출금금액', '출금액', '차변'];

    const normalize = (s: string) => String(s ?? '').replace(/\s/g, '').toLowerCase();

    const isNameHeader   = (h: string) => NAME_KEYWORDS.some((k) => normalize(h).includes(normalize(k)));
    const isAmountHeader = (h: string) =>
      AMOUNT_KEYWORDS.some((k) => normalize(h).includes(normalize(k))) &&
      !BALANCE_KEYWORDS.some((k) => normalize(h).includes(normalize(k)));

    let headerRowIdx = -1;
    let nameColIdx   = -1;
    let amountColIdx = -1;

    for (let r = 0; r < Math.min(rows.length, 10); r++) {
      const row = rows[r] as any[];
      const nIdx = row.findIndex((cell) => isNameHeader(String(cell)));
      const aIdx = row.findIndex((cell) => isAmountHeader(String(cell)));
      if (nIdx !== -1 && aIdx !== -1) {
        headerRowIdx = r;
        nameColIdx   = nIdx;
        amountColIdx = aIdx;
        break;
      }
    }

    const records: { depositorName: string; amount: number }[] = [];

    if (headerRowIdx !== -1) {
      // 헤더를 찾은 경우: 헤더 다음 행부터 파싱
      for (let i = headerRowIdx + 1; i < rows.length; i++) {
        const row           = rows[i] as any[];
        const depositorName = String(row[nameColIdx] ?? '').trim();
        const rawAmount     = row[amountColIdx];
        // 숫자 문자열에서 쉼표·공백 제거 후 파싱
        const amount        = Number(String(rawAmount ?? '').replace(/[,\s]/g, ''));
        if (depositorName && !isNaN(amount) && amount > 0) {
          records.push({ depositorName, amount });
        }
      }
    } else {
      // 헤더를 찾지 못한 경우: 첫 행이 숫자면 0행, 아니면 1행부터 A=입금자 B=금액로 폴백
      const startRow = isNaN(Number(rows[0]?.[1])) ? 1 : 0;
      for (let i = startRow; i < rows.length; i++) {
        const row           = rows[i] as any[];
        const depositorName = String(row[0] ?? '').trim();
        const amount        = Number(String(row[1] ?? '').replace(/[,\s]/g, ''));
        if (depositorName && !isNaN(amount) && amount > 0) {
          records.push({ depositorName, amount });
        }
      }
    }

    if (records.length === 0) {
      throw new BadRequestException(
        '입금자·금액 컬럼을 인식하지 못했습니다. ' +
        '헤더에 "입금자(명)/성명/이름/보내는분" 과 "금액/입금금액/거래금액" 항목이 있는지 확인하세요.',
      );
    }

    const result = await this.paymentsService.uploadPayments(BigInt(user.id), records);
    return {
      ...result,
      parsed: records.length,
      detectedNameCol:   headerRowIdx !== -1 ? (rows[headerRowIdx] as any[])[nameColIdx]   : 'A열(기본)',
      detectedAmountCol: headerRowIdx !== -1 ? (rows[headerRowIdx] as any[])[amountColIdx] : 'B열(기본)',
    };
  }

  @Get('upload-records')
  @ApiOperation({ summary: '미매칭 업로드 레코드 조회' })
  async getUnmatchedRecords(@CurrentUser() user: any) {
    return this.paymentsService.findUnmatchedRecords(BigInt(user.id));
  }

  @Post('upload-records/:id/match')
  @ApiOperation({ summary: '업로드 레코드 수기 매핑' })
  async matchUploadRecord(
    @Param('id') id: string,
    @Body('orderId') orderId: number,
    @CurrentUser() user: any,
  ) {
    if (!orderId) throw new BadRequestException('orderId가 필요합니다.');
    return this.paymentsService.matchUploadRecord(BigInt(id), BigInt(user.id), BigInt(orderId));
  }

  @Delete('upload-records/:id')
  @ApiOperation({ summary: '업로드 레코드 삭제' })
  async deleteUploadRecord(@Param('id') id: string, @CurrentUser() user: any) {
    return this.paymentsService.deleteUploadRecord(BigInt(id), BigInt(user.id));
  }
}
