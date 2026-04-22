import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Logger,
} from "@nestjs/common";
import { PrismaService } from "database/prisma.service";
import { AddCardDto } from "./dto/add-card.dto";

const MAX_CARDS = 5;

@Injectable()
export class CardService {
  private readonly logger = new Logger(CardService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─────────────────────────────────────────────────────────────────
  // ADD CARD
  // ─────────────────────────────────────────────────────────────────

  async addCard(userId: string, dto: AddCardDto) {
    // Limit: max 5 cards per user
    const count = await this.prisma.card.count({ where: { userId } });
    if (count >= MAX_CARDS) {
      throw new BadRequestException(`Maximum of ${MAX_CARDS} cards allowed`);
    }

    // No duplicate tokens
    const existing = await this.prisma.card.findUnique({
      where: { userId_cardToken: { userId, cardToken: dto.cardToken } },
    });
    if (existing) {
      throw new BadRequestException("This card is already saved");
    }

    // Check card is not expired
    const now = new Date();
    const expiry = new Date(
      parseInt(dto.expYear),
      parseInt(dto.expMonth) - 1,
      1,
    );
    if (expiry < now) {
      throw new BadRequestException("Card is expired");
    }

    // If set as default, unset all others first
    if (dto.isDefault) {
      await this.clearDefault(userId);
    }

    // First card is always default
    const isDefault = dto.isDefault ?? count === 0;

    const card = await this.prisma.card.create({
      data: {
        userId,
        cardToken: dto.cardToken,
        last4: dto.last4,
        brand: dto.brand,
        expMonth: dto.expMonth,
        expYear: dto.expYear,
        cardHolderName: dto.cardHolderName,
        isDefault,
      },
    });

    this.logger.log(
      `Card added for user ${userId}: ${dto.brand} ****${dto.last4}`,
    );

    return this.sanitize(card);
  }

  // ─────────────────────────────────────────────────────────────────
  // GET ALL CARDS
  // ─────────────────────────────────────────────────────────────────

  async getCards(userId: string) {
    const cards = await this.prisma.card.findMany({
      where: { userId },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    });

    return cards.map(this.sanitize);
  }

  // ─────────────────────────────────────────────────────────────────
  // SET DEFAULT CARD
  // ─────────────────────────────────────────────────────────────────

  async setDefault(userId: string, cardId: string) {
    const card = await this.findAndVerifyOwnership(userId, cardId);

    if (card.isDefault) return this.sanitize(card);

    await this.clearDefault(userId);

    const updated = await this.prisma.card.update({
      where: { id: cardId },
      data: { isDefault: true },
    });

    return this.sanitize(updated);
  }

  // ─────────────────────────────────────────────────────────────────
  // DELETE CARD
  // ─────────────────────────────────────────────────────────────────

  async deleteCard(userId: string, cardId: string) {
    const card = await this.findAndVerifyOwnership(userId, cardId);

    await this.prisma.card.delete({ where: { id: cardId } });

    // Promote next card to default if deleted card was default
    if (card.isDefault) {
      const next = await this.prisma.card.findFirst({
        where: { userId },
        orderBy: { createdAt: "desc" },
      });
      if (next) {
        await this.prisma.card.update({
          where: { id: next.id },
          data: { isDefault: true },
        });
      }
    }

    this.logger.log(`Card ${cardId} deleted for user ${userId}`);
    return { message: "Card removed successfully" };
  }

  // ─────────────────────────────────────────────────────────────────
  // PRIVATE HELPERS
  // ─────────────────────────────────────────────────────────────────

  private async findAndVerifyOwnership(userId: string, cardId: string) {
    const card = await this.prisma.card.findUnique({ where: { id: cardId } });

    if (!card) throw new NotFoundException("Card not found");
    if (card.userId !== userId) throw new ForbiddenException("Access denied");

    return card;
  }

  private async clearDefault(userId: string) {
    await this.prisma.card.updateMany({
      where: { userId, isDefault: true },
      data: { isDefault: false },
    });
  }

  // Strip cardToken from responses — never expose to frontend
  private sanitize(card: any) {
    const { cardToken, ...safe } = card;
    return safe;
  }
}
