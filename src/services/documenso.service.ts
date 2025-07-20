import { Injectable, BadRequestException } from '@nestjs/common';
import { Documenso } from '@documenso/sdk-typescript';
import { SignatureField } from '../utils/pdf.utils';
import * as fs from 'fs-extra';

export interface DocumensoSigner {
  name: string;
  email: string;
  role?: string;
}

export interface DocumensoDocument {
  title: string;
  file: Buffer;
  fileName: string;
  signers: DocumensoSigner[];
  signatureFields: SignatureField[];
}

@Injectable()
export class DocumensoService {
  private documenso: Documenso;

  constructor() {
    const apiKey = process.env.DOCUMENSO_API_KEY;
    if (!apiKey) {
      throw new Error('DOCUMENSO_API_KEY environment variable is required');
    }
    
    this.documenso = new Documenso({
      apiKey: apiKey,
    });
  }

  async createDocument(documentData: DocumensoDocument): Promise<string> {
    try {
      const result = await this.documenso.documents.createV0({
        title: documentData.title,
        recipients: documentData.signers.map(signer => ({
          email: signer.email,
          name: signer.name,
          role: (signer.role || 'SIGNER') as 'SIGNER' | 'CC' | 'VIEWER' | 'APPROVER' | 'ASSISTANT',
        })),
      });
      
      const documentId = result.document.id;
      const uploadUrl = result.uploadUrl;
      
      const formData = new FormData();
      formData.append('file', new Blob([documentData.file]), documentData.fileName);

      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error(`Failed to upload PDF: ${uploadResponse.status} ${uploadResponse.statusText}`);
      }

      return documentId.toString();
    } catch (error) {
      console.error('Documenso API error:', error);
      throw new BadRequestException('Failed to create document in Documenso: ' + error.message);
    }
  }

  private mapFieldType(type: string): 'SIGNATURE' | 'TEXT' | 'CHECKBOX' | 'DROPDOWN' | 'RADIO' | 'NUMBER' | 'DATE' | 'EMAIL' | 'NAME' | 'INITIALS' {
    switch (type) {
      case 'signature':
        return 'SIGNATURE';
      case 'text':
        return 'TEXT';
      case 'checkbox':
        return 'CHECKBOX';
      default:
        return 'SIGNATURE';
    }
  }

  async sendForSignature(documentId: string, signerEmail: string): Promise<void> {
    try {
      await this.documenso.documents.distribute({
        documentId: parseInt(documentId),
      });
    } catch (error) {
      console.error('Documenso send error:', error);
      throw new BadRequestException('Failed to send document for signature: ' + error.message);
    }
  }

  async getDocumentStatus(documentId: string): Promise<string> {
    try {
      
      const result = await this.documenso.documents.get({
        documentId: parseInt(documentId),
      });
      
      return result.status;
    } catch (error) {
      console.error('Documenso status error:', error);
      throw new BadRequestException('Failed to get document status: ' + error.message);
    }
  }

  async downloadSignedDocument(documentId: string): Promise<Buffer> {
    try {
      const result = await this.documenso.documents.get({
        documentId: parseInt(documentId),
      });
      if (result.status !== 'COMPLETED') {
        throw new Error(`Document is not completed. Current status: ${result.status}`);
      }
      const documentDataUrl = `https://openapi.documenso.com/v1/documents/${documentId}/data`;
      
      const response = await fetch(documentDataUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${process.env.DOCUMENSO_API_KEY}`,
        },
      });
      
      if (!response.ok) {
        throw new Error(`Failed to download document: ${response.status} ${response.statusText}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error) {
      console.error('Documenso download error:', error);
      throw new BadRequestException('Failed to download signed document: ' + error.message);
    }
  }
}