import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { WebScrapingService } from './services/web-scraping/web-scraping.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(3000);



  // let s = new WebScrapingService();
  // s.scrapeWalletAddress('0x7cbbba14c573fa52aadad44c7ae8085dc0764ebd')
}
bootstrap();
