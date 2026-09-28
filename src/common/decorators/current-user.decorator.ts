import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { CurrentUserData } from "../../auth/strategies/jwt.strategy";

export const CurrentUser = createParamDecorator((data: string, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest<{ user?: CurrentUserData }>();
  const user = request.user;

  return data ? user?.[data as keyof CurrentUserData] : user;
});
