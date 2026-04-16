import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common'



async function bootstrap() {
  const app = await NestFactory.create(AppModule);
   
app.enableCors({
    origin: '*', // allow all origins for now
  });
  
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true, 
    forbidNonWhitelisted: true
  }));
  // Swagger Config
  const config = new DocumentBuilder()
    .setTitle('Pay4Light API')
    .setDescription('API documentation for Pay4Light backend')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  await app.listen(process.env.PORT || 3000);
}
bootstrap();


