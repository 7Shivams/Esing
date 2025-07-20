import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum DocumentStatus {
  DRAFT = 'draft',
  PENDING_SIGNATURE = 'pending_signature',
  SIGNED = 'signed',
  COMPLETED = 'completed'
}

@Entity('documents')
export class Document {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  filename: string;

  @Column()
  originalName: string;

  @Column()
  filePath: string;

  @Column()
  fileSize: number;

  @Column({
    type: 'enum',
    enum: DocumentStatus,
    default: DocumentStatus.DRAFT
  })
  status: DocumentStatus;

  @Column({ type: 'jsonb', nullable: true })
  signFields: any[];

  @Column({ nullable: true })
  documensoId: string;

  @Column({ nullable: true })
  signedFilePath: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
