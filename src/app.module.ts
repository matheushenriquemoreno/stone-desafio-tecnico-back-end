import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import {
  configuration,
  validateEnvironment,
} from './shared/infrastructure/configuration';

@Module({
  imports: [
    ConfigModule.forRoot({
      cache: true,
      isGlobal: true,
      load: [configuration],
      validate: validateEnvironment,
    }),
  ],
})
export class AppModule {}
