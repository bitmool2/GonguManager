import { Module } from '@nestjs/common';
import { PortoneService } from './portone.service';
import { PortoneController } from './portone.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [PortoneController],
  providers: [PortoneService],
  exports: [PortoneService],
})
export class PortoneModule {}
