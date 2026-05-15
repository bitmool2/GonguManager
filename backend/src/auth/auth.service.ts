import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async register(email: string, password: string, name: string) {
    const existing = await this.usersService.findByEmail(email);
    if (existing) {
      throw new ConflictException('이미 등록된 이메일입니다.');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await this.usersService.create({
      email,
      passwordHash,
      name,
    });

    const token = this.generateToken(user);
    return { user: { id: Number(user.id), email: user.email, name: user.name }, token };
  }

  async login(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다.');
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다.');
    }

    const token = this.generateToken(user);
    return { user: { id: Number(user.id), email: user.email, name: user.name }, token };
  }

  async googleLogin(googleId: string, email: string, name: string) {
    let user = await this.usersService.findByGoogleId(googleId);
    if (!user) {
      user = await this.usersService.findByEmail(email);
      if (user) {
        user = await this.usersService.updateGoogleId(user.id, googleId);
      } else {
        user = await this.usersService.create({ email, name, googleId });
      }
    }

    const token = this.generateToken(user);
    return { user: { id: Number(user.id), email: user.email, name: user.name }, token };
  }

  private generateToken(user: { id: bigint; email: string }) {
    return this.jwtService.sign({
      sub: Number(user.id),
      email: user.email,
    });
  }
}
