import { Injectable } from '@nestjs/common';
import Stripe from 'stripe';
import { PrismaService } from '../prisma/prisma.service';
import { BIT_PACKAGES } from '../shop/shop.config';

@Injectable()
export class StripeService {
  public readonly client = new Stripe(process.env.STRIPE_SECRET_KEY ?? '');

  constructor(private prisma: PrismaService) {}

  // Acredita los Bits tras un Checkout completado.
  // Idempotente por event.id: si el evento ya se procesó, no hace nada.
  async grantBitsForCheckout(
    eventId: string,
    userId: number,
    packageKey: string,
  ) {
    if (!Number.isFinite(userId)) return;
    const pkg = BIT_PACKAGES.find((p) => p.key === packageKey);
    if (!pkg) return;

    const total = pkg.bits + pkg.bonus;

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.processedStripeEvent.create({
          data: { id: eventId, type: 'checkout.session.completed' },
        });
        await tx.user.update({
          where: { id: userId },
          data: { bits: { increment: total } },
        });
      });
    } catch (err) {
      const code = (err as { code?: string } | null)?.code;
      if (code === 'P2002') return; // ya procesado → idempotencia
      throw err;
    }
  }
}
