import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "database/prisma.service";
import { UpdateUserDto } from "./dto/update-user.dto";

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  // GET CURRENT USER
  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        phone: true,
        fullName: true,
        Meter: true,
        firstName: true,
        lastName: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    return user;
  }


async updateProfile(userId: string, dto: UpdateUserDto) {
  const updatedUser = await this.prisma.user.update({
    where: { id: userId },
    data: {
   
      ...(dto.fullName  ? { fullName: dto.fullName }   : {}),
      ...(dto.firstName ? { firstName: dto.firstName } : {}),
      ...(dto.lastName  ? { lastName: dto.lastName }   : {}),
      ...(dto.email     ? { email: dto.email }         : {}),
      ...(dto.phone     ? { phone: dto.phone }         : {}),
    },
    select: {
      id: true,
      fullName: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      role: true,
      isVerified: true,
      createdAt: true,
    },
  });

  return updatedUser;
}
}