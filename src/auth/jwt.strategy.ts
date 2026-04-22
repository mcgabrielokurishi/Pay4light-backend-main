import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { PrismaService } from "database/prisma.service";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.JWT_SECRET || "your-secret-key",
    });
  }

  async validate(payload: any) {
  
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        phone: true,
        firstName: true,
        lastName: true,
        fullName: true,
        role: true,
        isVerified: true,
        isActive: true,
        deletedAt: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException("User not found");
    }

    // Block deactivated accounts
    if (!user.isActive) {
      throw new UnauthorizedException("Account is deactivated");
    }

    // Block deleted accounts
    if (user.deletedAt) {
      throw new UnauthorizedException("Account has been deleted");
    }

    return user; // becomes req.user in controllers
  }
}
