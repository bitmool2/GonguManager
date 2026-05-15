import { IsString, IsNumber, IsOptional, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

class ProductOptionDto {
  @ApiProperty({ example: '빨강' })
  @IsString()
  optionName: string;

  @ApiProperty({ example: 100 })
  @IsNumber()
  stock: number;
}

export class CreateProductDto {
  @ApiProperty({ example: '핸드메이드 비누' })
  @IsString()
  name: string;

  @ApiProperty({ example: 15000 })
  @IsNumber()
  price: number;

  @ApiProperty({ example: 100 })
  @IsNumber()
  stock: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductOptionDto)
  options?: ProductOptionDto[];
}
