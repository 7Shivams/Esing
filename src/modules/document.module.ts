import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentController } from '../controllers/document.controller';
import { DocumentService } from '../services/document.service';
import { DocumensoService } from '../services/documenso.service';
import { Document } from '../entities/document.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Document])],
  controllers: [DocumentController],
  providers: [DocumentService, DocumensoService],
  exports: [DocumentService],
})
export class DocumentModule {}
