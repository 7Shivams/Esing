import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UploadedFile,
  UseInterceptors,
  Res,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { DocumentService } from '../services/document.service';
import { SignatureField } from '../utils/pdf.utils';
import * as fs from 'fs-extra';

@Controller('documents')
export class DocumentController {
  constructor(private readonly documentService: DocumentService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadDocument(@UploadedFile() file: Express.Multer.File) {
    return this.documentService.uploadDocument(file);
  }

  @Get()
  async getAllDocuments() {
    return this.documentService.getAllDocuments();
  }

  @Get(':id')
  async getDocument(@Param('id') id: string) {
    return this.documentService.getDocument(id);
  }

  @Get(':id/info')
  async getPdfInfo(@Param('id') id: string) {
    return this.documentService.getPdfInfo(id);
  }

  @Get(':id/download')
  async downloadDocument(@Param('id') id: string, @Res() res: Response) {
    const { buffer, filename } = await this.documentService.getDocumentFile(id);
    
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    
    res.end(buffer);
  }

  @Get(':id/view')
  async viewDocument(@Param('id') id: string, @Res() res: Response) {
    const { buffer } = await this.documentService.getDocumentFile(id);
    
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Length': buffer.length,
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    
    res.end(buffer);
  }

  @Put(':id/signature-fields')
  async addSignatureFields(
    @Param('id') id: string,
    @Body() body: { fields: SignatureField[] }
  ) {
    if (!body.fields || !Array.isArray(body.fields)) {
      throw new BadRequestException('Fields array is required');
    }
    
    return this.documentService.addSignatureFields(id, body.fields);
  }

  @Post(':id/submit')
  async submitForSignature(
    @Param('id') id: string,
    @Body() body: { signerEmail: string; signerName?: string }
  ) {
    if (!body.signerEmail) {
      throw new BadRequestException('Signer email is required');
    }
    
    return this.documentService.submitForSignature(id, body.signerEmail, body.signerName);
  }

  @Get(':id/status')
  async checkDocumentStatus(@Param('id') id: string) {
    return this.documentService.checkDocumentStatus(id);
  }

  @Get(':id/signed')
  async downloadSignedDocument(@Param('id') id: string, @Res() res: Response) {
    const document = await this.documentService.getDocument(id);
    
    if (!document.signedFilePath || !document.signedFilePath) {
      throw new BadRequestException('Signed document not available');
    }
    
    const buffer = await fs.readFile(document.signedFilePath);
    const filename = `signed_${document.originalName}`;
    
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    
    res.end(buffer);
  }

  @Delete(':id')
  async deleteDocument(@Param('id') id: string) {
    await this.documentService.deleteDocument(id);
    return { message: 'Document deleted successfully' };
  }
}
