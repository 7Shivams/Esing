import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DocumentService } from './document.service';
import { Document, DocumentStatus } from '../entities/document.entity';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('DocumentService', () => {
  let service: DocumentService;
  let repository: Repository<Document>;

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentService,
        {
          provide: getRepositoryToken(Document),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<DocumentService>(DocumentService);
    repository = module.get<Repository<Document>>(getRepositoryToken(Document));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('uploadDocument', () => {
    it('should upload a valid PDF document', async () => {
      const mockFile = {
        originalname: 'test.pdf',
        mimetype: 'application/pdf',
        size: 1024,
        buffer: Buffer.from('test'),
      } as Express.Multer.File;

      const mockDocument = {
        id: 'test-id',
        filename: 'test.pdf',
        originalName: 'test.pdf',
        filePath: 'uploads/test.pdf',
        fileSize: 1024,
        status: DocumentStatus.DRAFT,
      };

      mockRepository.create.mockReturnValue(mockDocument);
      mockRepository.save.mockResolvedValue(mockDocument);

      const result = await service.uploadDocument(mockFile);

      expect(result).toEqual(mockDocument);
      expect(mockRepository.create).toHaveBeenCalledWith({
        filename: expect.any(String),
        originalName: 'test.pdf',
        filePath: expect.any(String),
        fileSize: 1024,
        status: DocumentStatus.DRAFT,
      });
    });

    it('should throw BadRequestException when no file is provided', async () => {
      await expect(service.uploadDocument(undefined as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for non-PDF files', async () => {
      const mockFile = {
        originalname: 'test.txt',
        mimetype: 'text/plain',
        size: 1024,
        buffer: Buffer.from('test'),
      } as Express.Multer.File;

      await expect(service.uploadDocument(mockFile)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getDocument', () => {
    it('should return a document by id', async () => {
      const mockDocument = {
        id: 'test-id',
        filename: 'test.pdf',
        status: DocumentStatus.DRAFT,
      };

      mockRepository.findOne.mockResolvedValue(mockDocument);

      const result = await service.getDocument('test-id');

      expect(result).toEqual(mockDocument);
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'test-id' },
      });
    });

    it('should throw NotFoundException when document not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.getDocument('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getAllDocuments', () => {
    it('should return all documents ordered by creation date', async () => {
      const mockDocuments = [
        { id: '1', filename: 'doc1.pdf' },
        { id: '2', filename: 'doc2.pdf' },
      ];

      mockRepository.find.mockResolvedValue(mockDocuments);

      const result = await service.getAllDocuments();

      expect(result).toEqual(mockDocuments);
      expect(mockRepository.find).toHaveBeenCalledWith({
        order: { createdAt: 'DESC' },
      });
    });
  });

  describe('addSignatureFields', () => {
    it('should add signature fields to document', async () => {
      const mockDocument = {
        id: 'test-id',
        filename: 'test.pdf',
        filePath: 'uploads/test.pdf',
        status: DocumentStatus.DRAFT,
      };

      const fields = [
        {
          id: 'sig1',
          x: 100,
          y: 100,
          width: 200,
          height: 50,
          page: 1,
          type: 'signature' as const,
        },
      ];

      mockRepository.findOne.mockResolvedValue(mockDocument);
      mockRepository.save.mockResolvedValue({
        ...mockDocument,
        signFields: fields,
        status: DocumentStatus.PENDING_SIGNATURE,
      });

      const result = await service.addSignatureFields('test-id', fields);

      expect(result.status).toBe(DocumentStatus.PENDING_SIGNATURE);
      expect(result.signFields).toEqual(fields);
    });
  });

  describe('submitForSignature', () => {
    it('should submit document for signature', async () => {
      const mockDocument = {
        id: 'test-id',
        status: DocumentStatus.PENDING_SIGNATURE,
        filename: 'test.pdf',
        filePath: 'uploads/test.pdf',
      };

      mockRepository.findOne.mockResolvedValue(mockDocument);
      mockRepository.save.mockResolvedValue({
        ...mockDocument,
        documensoId: 'doc-123',
        status: DocumentStatus.SIGNED,
        signedFilePath: 'signed/completed_test.pdf',
      });

      const result = await service.submitForSignature('test-id', 'test@example.com');

      expect(result.status).toBe(DocumentStatus.SIGNED);
      expect(result.documensoId).toBeDefined();
    });

    it('should throw BadRequestException for non-pending documents', async () => {
      const mockDocument = {
        id: 'test-id',
        status: DocumentStatus.DRAFT,
      };

      mockRepository.findOne.mockResolvedValue(mockDocument);

      await expect(
        service.submitForSignature('test-id', 'test@example.com'),
      ).rejects.toThrow(BadRequestException);
    });
  });
}); 