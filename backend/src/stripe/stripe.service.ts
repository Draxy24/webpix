import { Injectable } from '@nestjs/common';
import Stripe from 'stripe';
import { PrismaService } from '../prisma/prisma.service';
import { BIT_PACKAGES, SUBSCRIPTION_PLANS } from '../shop/shop.config';

@Injectable()
export class StripeService {
  public readonly client = new Stripe(process.env.STRIPE_SECRET_KEY ?? '');

  constructor(private prisma: PrismaService) {}

  // Bits (compra única). Idempotente por event.id.
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
      if (code === 'P2002') return;
      throw err;
    }
  }

  async setSubscriptionTier(userId: number, tier: 'FREE' | 'PLUS' | 'PREMIUM') {
    if (!Number.isFinite(userId)) return;
    await this.prisma.user.updateMany({
      where: { id: userId },
      data: { subscriptionTier: tier },
    });
  }

  // Estipendio mensual (primer pago y cada renovación). Idempotente por event.id.
  async grantStipendForCustomer(eventId: string, customerId: string) {
    const subs = await this.client.subscriptions.list({
      customer: customerId,
      limit: 1,
    });
    const sub = subs.data[0];
    if (!sub) return;

    const userId = Number(sub.metadata?.userId);
    const tier = sub.metadata?.tier;
    if (!Number.isFinite(userId)) return;
    const plan = SUBSCRIPTION_PLANS[tier as keyof typeof SUBSCRIPTION_PLANS];
    if (!plan) return;
    const bits = plan.bitsPerMonth;

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.processedStripeEvent.create({
          data: { id: eventId, type: 'invoice.paid' },
        });
        await tx.user.update({
          where: { id: userId },
          data: { bits: { increment: bits } },
        });
      });
    } catch (err) {
      const code = (err as { code?: string } | null)?.code;
      if (code === 'P2002') return;
      throw err;
    }
  }

  // Cancela todas las suscripciones de un customer (al eliminar la cuenta).
  async cancelSubscriptionsForCustomer(customerId: string) {
    const subs = await this.client.subscriptions.list({
      customer: customerId,
      status: 'all',
      limit: 100,
    });
    for (const sub of subs.data) {
      if (sub.status !== 'canceled' && sub.status !== 'incomplete_expired') {
        try {
          await this.client.subscriptions.cancel(sub.id);
        } catch {
          // ya cancelada o no cancelable: continuar
        }
      }
    }
  }
}
