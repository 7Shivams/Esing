import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Document, DocumentStatus } from '../entities/document.entity';
import { PdfUtils, SignatureField } from '../utils/pdf.utils';
import { DocumensoService, DocumensoSigner } from './documenso.service';
import * as fs from 'fs-extra';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class DocumentService {
  private readonly uploadDir = path.join(process.cwd(), 'uploads');
  private readonly signedDir = path.join(process.cwd(), 'signed');

  constructor(
    @InjectRepository(Document)
    private documentRepository: Repository<Document>,
    private documensoService: DocumensoService,
  ) {
    this.ensureDirectories();
  }

  private async ensureDirectories() {
    await fs.ensureDir(this.uploadDir);
    await fs.ensureDir(this.signedDir);
  }

  async uploadDocument(file: Express.Multer.File): Promise<Document> {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    if (!file.mimetype.includes('pdf')) {
      throw new BadRequestException('Only PDF files are allowed');
    }

    const filename = `${uuidv4()}.pdf`;
    const filePath = path.join(this.uploadDir, filename);

    await fs.writeFile(filePath, file.buffer);

    const document = this.documentRepository.create({
      filename,
      originalName: file.originalname,
      filePath,
      fileSize: file.size,
      status: DocumentStatus.DRAFT,
    });

    return this.documentRepository.save(document);
  }

  async getDocument(id: string): Promise<Document> {
    const document = await this.documentRepository.findOne({ where: { id } });
    if (!document) {
      throw new NotFoundException('Document not found');
    }
    return document;
  }

  async getAllDocuments(): Promise<Document[]> {
    return this.documentRepository.find({
      order: { createdAt: 'DESC' }
    });
  }

  async addSignatureFields(
    id: string,
    fields: SignatureField[]
  ): Promise<Document> {
    
    const document = await this.getDocument(id);
    
    const outputFilename = `signed_${document.filename}`;
    const outputPath = path.join(this.uploadDir, outputFilename);

    await PdfUtils.addSignatureFields(document.filePath, fields, outputPath);

    document.signFields = fields;
    document.status = DocumentStatus.PENDING_SIGNATURE;

    const savedDocument = await this.documentRepository.save(document);
    
    return savedDocument;
  }

  async getPdfInfo(id: string) {
    const document = await this.getDocument(id);
    return PdfUtils.getPdfInfo(document.filePath);
  }

  async submitForSignature(id: string, signerEmail: string, signerName?: string): Promise<Document> {
    
    const document = await this.getDocument(id);
    
    if (document.status !== DocumentStatus.PENDING_SIGNATURE) {
      throw new BadRequestException('Document must be in pending signature status');
    }

    if (!document.signFields || document.signFields.length === 0) {
      throw new BadRequestException('Document must have signature fields before submitting');
    }

    try {
      const pdfBuffer = await fs.readFile(document.filePath);
      const signers: DocumensoSigner[] = [{
        name: signerName || 'Signer',
        email: signerEmail,
        role: 'SIGNER'
      }];

      const documensoId = await this.documensoService.createDocument({
        title: document.originalName,
        file: pdfBuffer,
        fileName: document.originalName,
        signers,
        signatureFields: document.signFields,
      });
      await this.documensoService.sendForSignature(documensoId, signerEmail);
      document.documensoId = documensoId;
      document.status = DocumentStatus.PENDING_SIGNATURE; 
      
      return this.documentRepository.save(document);
    } catch (error) {
      console.error('Error submitting to Documenso:', error);
      throw new BadRequestException('Failed to submit document for signature: ' + error.message);
    }
  }

  async getDocumentFile(id: string): Promise<{ buffer: Buffer; filename: string }> {
    const document = await this.getDocument(id);
    
    if (!fs.existsSync(document.filePath)) {
      throw new NotFoundException('Document file not found');
    }

    const buffer = await fs.readFile(document.filePath);
    return { buffer, filename: document.originalName };
  }

  async checkDocumentStatus(id: string): Promise<Document> {
    const document = await this.getDocument(id);
    
    if (!document.documensoId) {
      throw new BadRequestException('Document not submitted to Documenso');
    }

    try {
      const status = await this.documensoService.getDocumentStatus(document.documensoId);
      
      if (status === 'COMPLETED') {
        document.status = DocumentStatus.COMPLETED;
        
        try {
          const signedPdfBuffer = await this.documensoService.downloadSignedDocument(document.documensoId);
          const signedFilename = `signed_${document.filename}`;
          const signedPath = path.join(this.signedDir, signedFilename);
          await fs.writeFile(signedPath, signedPdfBuffer);
          document.signedFilePath = signedPath;
        } catch (downloadError) {
          console.error('Failed to download signed document:', downloadError);
        }
      } else if (status === 'SIGNED') {
        document.status = DocumentStatus.SIGNED;
      } else if (status === 'PENDING') {
        document.status = DocumentStatus.PENDING_SIGNATURE;
      } else if (status === 'DRAFT') {
        document.status = DocumentStatus.DRAFT;
      }
      
      const savedDocument = await this.documentRepository.save(document);
      
      return savedDocument;
    } catch (error) {
      console.error('Error checking document status:', error);
      throw new BadRequestException('Failed to check document status');
    }
  }

  async deleteDocument(id: string): Promise<void> {
    const document = await this.getDocument(id);
    
    if (fs.existsSync(document.filePath)) {
      await fs.unlink(document.filePath);
    }
    
    if (document.signedFilePath && fs.existsSync(document.signedFilePath)) {
      await fs.unlink(document.signedFilePath);
    }

    await this.documentRepository.remove(document);
  }
}
