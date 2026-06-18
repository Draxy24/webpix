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

    // Compra única de Bits
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

    // Tier de suscripción
    if (
      event.type === 'customer.subscription.created' ||
      event.type === 'customer.subscription.updated' ||
      event.type === 'customer.subscription.deleted'
    ) {
      const sub = event.data.object as {
        status?: string;
        metadata?: { userId?: string; tier?: string } | null;
      };
      const userId = Number(sub.metadata?.userId);
      const metaTier = sub.metadata?.tier;
      const keep =
        event.type !== 'customer.subscription.deleted' &&
        ['active', 'trialing', 'past_due'].includes(sub.status ?? '');
      const tier =
        keep && (metaTier === 'PLUS' || metaTier === 'PREMIUM')
          ? metaTier
          : 'FREE';
      await this.stripe.setSubscriptionTier(userId, tier);
    }

    // Estipendio mensual
    if (event.type === 'invoice.paid') {
      const invoice = event.data.object as { customer?: string };
      if (invoice.customer) {
        await this.stripe.grantStipendForCustomer(event.id, invoice.customer);
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
