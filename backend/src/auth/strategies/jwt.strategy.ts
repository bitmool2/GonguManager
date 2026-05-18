import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from '../../users/users.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private usersService: UsersService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.JWT_SECRET || 'gongu-manager-jwt-secret',
    });
  }

  async validate(payload: { sub: number; email: string }) {
    const user = await this.usersService.findById(BigInt(payload.sub));
    if (!user) {
      throw new UnauthorizedException();
    }
    return { id: Number(user.id), email: user.email, name: user.name, role: user.role };
  }
}
