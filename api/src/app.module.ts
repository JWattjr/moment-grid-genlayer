import { Global, Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";
import { AppConfig, CONFIG, loadConfiguration } from "./config/configuration";
import { MatchController } from "./match/match.controller";
import { MatchService } from "./match/match.service";
import { Match, MatchSchema } from "./match/schemas/match.schema";

const configProvider = { provide: CONFIG, useFactory: loadConfiguration };

@Global()
@Module({
  providers: [configProvider],
  exports: [configProvider],
})
class AppConfigModule {}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AppConfigModule,
    MongooseModule.forRootAsync({
      inject: [CONFIG],
      useFactory: (config: AppConfig) => ({ uri: config.mongodbUri }),
    }),
    MongooseModule.forFeature([{ name: Match.name, schema: MatchSchema }]),
  ],
  controllers: [MatchController],
  providers: [MatchService],
})
export class AppModule {}
