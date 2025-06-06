import { Controller, Get, Query, Res } from "@nestjs/common";
import { AppService } from "./app.service";
import { ConfigService } from "@nestjs/config";
import { Response } from "express";

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly configService: ConfigService
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get("coffee")
  getBuyCoffee(@Query("coffee") coffee: string, @Res() res: Response): void {
    this.appService.logCoffee(coffee);
    res.redirect(303, this.configService.getOrThrow("BUY_COFFEE_LINK"));
  }
}
