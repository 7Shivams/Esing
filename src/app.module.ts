import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DocumentModule } from './modules/document.module';
import { Document } from './entities/document.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',        
      port: parseInt(process.env.DB_PORT || '5432'),                
      username: process.env.DB_USERNAME || 'postgres',     
      password: process.env.DB_PASSWORD || 'password',
      database: process.env.DB_NAME || 'esign_db',     
      entities: [Document],
      autoLoadEntities: true,   
      synchronize: true,         
    }),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'uploads'),
      serveRoot: '/uploads',
    }),
    DocumentModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
