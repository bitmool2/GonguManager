import { IsString, IsArray, ValidateNested, IsNumber, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

class OrderItemDto {
  @ApiProperty()
  @IsNumber()
  productId: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  optionId?: number;

  @ApiProperty()
  @IsNumber()
  quantity: number;
}

export class CreateOrderDto {
  @ApiProperty({ example: '김철수' })
  @IsString()
  customerName: string;

  @ApiProperty({ example: '010-1234-5678' })
  @IsString()
  phone: string;

  @ApiProperty({ example: '12345' })
  @IsOptional()
  @IsString()
  zipNo?: string;

  @ApiProperty({ example: '서울시 강남구 테헤란로 123' })
  @IsString()
  addrBase: string;

  @ApiProperty({ example: '101동 202호' })
  @IsOptional()
  @IsString()
  addrDetail?: string;

  @ApiProperty({ example: '김철수' })
  @IsOptional()
  @IsString()
  depositName?: string;

  @ApiProperty({ type: [OrderItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];
}
