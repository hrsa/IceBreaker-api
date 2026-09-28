import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from "@nestjs/common";
import { Observable } from "rxjs";
import { CurrentUserData } from "../../auth/strategies/jwt.strategy";

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest<{ user?: CurrentUserData }>();
    const user = request.user;

    if (!user || user.isAdmin !== true) {
      throw new ForbiddenException("Access denied: Admin privileges required");
    }

    return true;
  }
}
