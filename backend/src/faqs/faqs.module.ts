import { Module } from '@nestjs/common';
import { FaqsService } from './faqs.service';
import { FaqsController } from './faqs.controller';

@Module({
  providers: [FaqsService],
  controllers: [FaqsController],
  exports: [FaqsService],
})
export class FaqsModule {}
