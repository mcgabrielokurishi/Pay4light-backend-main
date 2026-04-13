import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";

@Injectable()
export class TokensService {
  constructor(private jwt: JwtService) {}

  generateAccessToken(userId: string) {
    return this.jwt.sign({ sub: userId });
  }

  async hashToken(token: string) {
    return bcrypt.hash(token, 10);
  }

  async compare(token: string, hash: string) {
    return bcrypt.compare(token, hash);
  }
}
