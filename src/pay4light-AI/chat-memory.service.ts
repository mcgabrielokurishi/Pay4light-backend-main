import { Injectable } from "@nestjs/common";
import { PrismaService } from "database/prisma.service";

@Injectable()
export class ChatMemoryService {
  constructor(private prisma: PrismaService) {}

  async saveMessage(userId: string, role: "user" | "assistant", message: string) {
    await this.prisma.aIConversation.create({
      data: {
        userId,
        role,
        message,
      },
    });
  }

  async getRecentMessages(userId: string, limit = 10) {
    return this.prisma.aIConversation.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }
}
