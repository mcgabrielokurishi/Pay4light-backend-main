import { AuthModule } from 'src/auth/auth.module';
import { Module } from '@nestjs/common';
import { DiscoController } from './disco.controller';
import { DiscoService } from './disco.service';

@Module({
  imports: [AuthModule],
  controllers: [DiscoController],
  providers: [DiscoService],
  exports: [DiscoService],
})
export class DiscoModule {}