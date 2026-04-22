import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Body,
  Param,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { CardService } from "./card.service";
import { AddCardDto } from "./dto/add-card.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller("cards")
@UseGuards(JwtAuthGuard)
export class CardController {
  constructor(private readonly cardService: CardService) {}

  /**
   * GET /cards
   * Returns all saved cards for the logged-in user.
   * Note: cardToken is stripped from all responses.
   */
  @Get()
  async getAll(@Req() req: any) {
    return this.cardService.getCards(req.user.id);
  }

  /**
   * POST /cards
   * Save a new card.
   * Body: { cardToken, last4, brand, expMonth, expYear, cardHolderName?, isDefault? }
   *
   * NOTE: cardToken should come from your payment provider's (Paystack/Flutterwave)
   * charge response — never accept raw card numbers from the frontend.
   */
  @Post()
  async add(@Req() req: any, @Body() dto: AddCardDto) {
    return this.cardService.addCard(req.user.id, dto);
  }

  /**
   * PATCH /cards/:id/set-default
   * Set a saved card as the default.
   */
  @Patch(":id/set-default")
  @HttpCode(HttpStatus.OK)
  async setDefault(@Req() req: any, @Param("id") cardId: string) {
    return this.cardService.setDefault(req.user.id, cardId);
  }

  /**
   * DELETE /cards/:id
   * Remove a saved card.
   */
  @Delete(":id")
  @HttpCode(HttpStatus.OK)
  async remove(@Req() req: any, @Param("id") cardId: string) {
    return this.cardService.deleteCard(req.user.id, cardId);
  }
}
