import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';

@Injectable()
export class AdminGuard extends JwtAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    await super.canActivate(context);
    const req = context.switchToHttp().getRequest();
    if (req.user?.role !== 'admin') {
      throw new ForbiddenException('관리자 권한이 필요합니다.');
    }
    return true;
  }
}
