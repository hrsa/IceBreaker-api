import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from "@nestjs/common";
import { ProfilesService } from "../../profiles/profiles.service";

@Injectable()
export class ProfileOwnerGuard implements CanActivate {
  constructor(private profilesService: ProfilesService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException("Not authenticated");
    }

    const profileId = request.query.profileId || (request.params && request.params.profileId);

    if (!profileId || user.isAdmin === true) {
      return true;
    }

    try {
      await this.profilesService.findOne(profileId, user.id, user.isAdmin);
      return true;
    } catch (error) {
      return false;
    }
  }
}
