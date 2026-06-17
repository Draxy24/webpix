import {
  Controller,
  Post,
  Req,
  Headers,
  BadRequestException,
  type RawBodyRequest,
} from '@nestjs/common';
import type { Request } from 'express';
import { StripeService } from './stripe.service';

@Controller('stripe')
export class StripeController {
  constructor(private stripe: StripeService) {}

  @Post('webhook')
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    if (!req.rawBody) {
      throw new BadRequestException('Falta el cuerpo crudo de la petición');
    }
    const secret = process.env.STRIPE_WEBHOOK_SECRET ?? '';
    const event = this.verify(req.rawBody, signature, secret);

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as {
        metadata?: { userId?: string; packageKey?: string } | null;
      };
      const userId = Number(session.metadata?.userId);
      const packageKey = session.metadata?.packageKey;
      if (packageKey) {
        await this.stripe.grantBitsForCheckout(event.id, userId, packageKey);
      }
    }

    return { received: true };
  }

  private verify(payload: Buffer, signature: string, secret: string) {
    try {
      return this.stripe.client.webhooks.constructEvent(
        payload,
        signature,
        secret,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'desconocido';
      throw new BadRequestException(`Firma de webhook inválida: ${msg}`);
    }
  }
}
