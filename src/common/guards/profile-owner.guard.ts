import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { ProfilesService } from '../../profiles/profiles.service';

@Injectable()
export class ProfileOwnerGuard implements CanActivate {
  constructor(private profilesService: ProfilesService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Not authenticated');
    }

    // Get profileId from query params or route params
    let profileId = request.query.profileId ||
      (request.params && request.params.profileId);

    if (!profileId || user.isAdmin === true) {
      return true;
    }

    try {
      const profile = await this.profilesService.findOne(profileId);

      if (profile.userId !== user.userId) {
        throw new ForbiddenException('You can only access your own profiles');
      }

      return true;
    } catch (error) {
      throw new ForbiddenException('Profile not found or access denied');
    }
  }
}
