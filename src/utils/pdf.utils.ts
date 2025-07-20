import { PDFDocument, PDFForm, PDFTextField, PDFCheckBox } from 'pdf-lib';
import * as fs from 'fs-extra';
import * as path from 'path';

export interface SignatureField {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
  type: 'signature' | 'text' | 'checkbox';
  label?: string;
}

export class PdfUtils {
  static async addSignatureFields(
    pdfPath: string,
    fields: SignatureField[],
    outputPath: string
  ): Promise<void> {
    const pdfBytes = await fs.readFile(pdfPath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    
    const form = pdfDoc.getForm();
    
    fields.forEach(field => {
      const page = pdfDoc.getPage(field.page - 1);
      const { width, height } = page.getSize();
      
      const x = field.x;
      const y = height - field.y - field.height;
      
      switch (field.type) {
        case 'signature':
          const sigField = form.createTextField(field.id);
          sigField.addToPage(page, {
            x,
            y,
            width: field.width,
            height: field.height
          });
          sigField.setText('[SIGNATURE FIELD]');
          break;
        case 'text':
          const textField = form.createTextField(field.id);
          textField.addToPage(page, {
            x,
            y,
            width: field.width,
            height: field.height
          });
          if (field.label) {
            textField.setText(field.label);
          }
          break;
        case 'checkbox':
          const checkbox = form.createCheckBox(field.id);
          checkbox.addToPage(page, {
            x,
            y,
            width: field.width,
            height: field.height
          });
          break;
      }
    });
    
    const modifiedPdfBytes = await pdfDoc.save();
    await fs.writeFile(outputPath, modifiedPdfBytes);
  }

  static async getPdfInfo(pdfPath: string): Promise<{
    pageCount: number;
    size: Array<{ width: number; height: number }>;
  }> {
    const pdfBytes = await fs.readFile(pdfPath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pageCount = pdfDoc.getPageCount();
    
    const sizes: Array<{ width: number; height: number }> = [];
    for (let i = 0; i < pageCount; i++) {
      const page = pdfDoc.getPage(i);
      const { width, height } = page.getSize();
      sizes.push({ width, height });
    }
    
    return { pageCount, size: sizes };
  }

  static async createThumbnail(pdfPath: string, outputPath: string): Promise<void> {
    await fs.copy(pdfPath, outputPath);
  }
} 