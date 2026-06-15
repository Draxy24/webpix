import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AchievementsService } from '../achievements/achievements.service';
import { PixelGateway } from '../pixel/pixel.gateway';

@Injectable()
export class FriendshipsService {
  constructor(
    private prisma: PrismaService,
    private achievements: AchievementsService,
    private gateway: PixelGateway,
  ) {}

  async sendRequest(senderId: number, receiverNickname: string) {
    const receiver = await this.prisma.user.findUnique({
      where: { nickname: receiverNickname },
    });
    if (!receiver) throw new NotFoundException('Usuario no encontrado');
    if (receiver.id === senderId)
      throw new BadRequestException('No puedes enviarte solicitud a ti mismo');

    const me = await this.prisma.user.findUnique({
      where: { id: senderId },
      select: { nickname: true },
    });
    const myNick = me?.nickname ?? '';

    const existing = await this.prisma.friendship.findFirst({
      where: {
        OR: [
          { senderId, receiverId: receiver.id },
          { senderId: receiver.id, receiverId: senderId },
        ],
      },
    });

    if (existing) {
      if (existing.status === 'ACCEPTED') {
        throw new BadRequestException('Ya son amigos');
      }
      if (existing.status === 'PENDING') {
        if (existing.senderId === senderId) {
          throw new BadRequestException(
            'Ya enviaste una solicitud a este usuario',
          );
        }
        // El otro ya nos envió solicitud → aceptamos automáticamente
        const accepted = await this.prisma.friendship.update({
          where: { id: existing.id },
          data: { status: 'ACCEPTED' },
        });
        await this.achievements.checkFriends(accepted.senderId);
        await this.achievements.checkFriends(accepted.receiverId);
        // El solicitante original (el otro) se entera de que ya son amigos
        this.gateway.emitToUser(existing.senderId, {
          kind: 'FRIEND_ACCEPTED',
          nickname: myNick,
        });
        return accepted;
      }
      // Si estaba DECLINED, permitimos reintentar borrando la anterior
      await this.prisma.friendship.delete({ where: { id: existing.id } });
    }

    const created = await this.prisma.friendship.create({
      data: { senderId, receiverId: receiver.id },
    });
    this.gateway.emitToUser(receiver.id, {
      kind: 'FRIEND_REQUEST',
      fromNickname: myNick,
    });
    return created;
  }

  async accept(friendshipId: number, userId: number) {
    const friendship = await this.prisma.friendship.findUnique({
      where: { id: friendshipId },
    });
    if (!friendship) throw new NotFoundException('Solicitud no encontrada');
    if (friendship.receiverId !== userId)
      throw new ForbiddenException('No puedes aceptar esta solicitud');
    if (friendship.status !== 'PENDING')
      throw new BadRequestException('Esta solicitud ya fue procesada');

    const accepted = await this.prisma.friendship.update({
      where: { id: friendshipId },
      data: { status: 'ACCEPTED' },
    });
    await this.achievements.checkFriends(accepted.senderId);
    await this.achievements.checkFriends(accepted.receiverId);

    const me = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { nickname: true },
    });
    // El solicitante original se entera de que aceptaste
    this.gateway.emitToUser(accepted.senderId, {
      kind: 'FRIEND_ACCEPTED',
      nickname: me?.nickname ?? '',
    });
    return accepted;
  }

  async decline(friendshipId: number, userId: number) {
    const friendship = await this.prisma.friendship.findUnique({
      where: { id: friendshipId },
    });
    if (!friendship) throw new NotFoundException('Solicitud no encontrada');
    if (friendship.receiverId !== userId)
      throw new ForbiddenException('No puedes declinar esta solicitud');
    if (friendship.status !== 'PENDING')
      throw new BadRequestException('Esta solicitud ya fue procesada');

    return this.prisma.friendship.update({
      where: { id: friendshipId },
      data: { status: 'DECLINED' },
    });
  }

  async remove(friendshipId: number, userId: number) {
    const friendship = await this.prisma.friendship.findUnique({
      where: { id: friendshipId },
    });
    if (!friendship) throw new NotFoundException('Amistad no encontrada');
    if (friendship.senderId !== userId && friendship.receiverId !== userId) {
      throw new ForbiddenException('No puedes eliminar esta amistad');
    }
    await this.prisma.friendship.delete({ where: { id: friendshipId } });
    return { success: true };
  }

  async listFriends(userId: number) {
    const friendships = await this.prisma.friendship.findMany({
      where: {
        status: 'ACCEPTED',
        OR: [{ senderId: userId }, { receiverId: userId }],
      },
      include: {
        sender: { select: { id: true, nickname: true, profilePic: true } },
        receiver: { select: { id: true, nickname: true, profilePic: true } },
      },
    });

    return friendships.map((f) => {
      const friend = f.senderId === userId ? f.receiver : f.sender;
      return { friendshipId: f.id, ...friend };
    });
  }

  async listIncoming(userId: number) {
    const requests = await this.prisma.friendship.findMany({
      where: { receiverId: userId, status: 'PENDING' },
      include: {
        sender: { select: { id: true, nickname: true, profilePic: true } },
      },
    });
    return requests.map((r) => ({
      friendshipId: r.id,
      sender: r.sender,
      createdAt: r.createdAt,
    }));
  }

  async listOutgoing(userId: number) {
    const requests = await this.prisma.friendship.findMany({
      where: { senderId: userId, status: 'PENDING' },
      include: {
        receiver: { select: { id: true, nickname: true, profilePic: true } },
      },
    });
    return requests.map((r) => ({
      friendshipId: r.id,
      receiver: r.receiver,
      createdAt: r.createdAt,
    }));
  }

  async getStatus(userId: number, otherNickname: string) {
    const other = await this.prisma.user.findUnique({
      where: { nickname: otherNickname },
    });
    if (!other) return { status: 'NONE' };
    if (other.id === userId) return { status: 'SELF' };

    const friendship = await this.prisma.friendship.findFirst({
      where: {
        OR: [
          { senderId: userId, receiverId: other.id },
          { senderId: other.id, receiverId: userId },
        ],
      },
    });

    if (!friendship) return { status: 'NONE' };
    if (friendship.status === 'ACCEPTED')
      return { status: 'FRIENDS', friendshipId: friendship.id };
    if (friendship.status === 'PENDING') {
      const isFromMe = friendship.senderId === userId;
      return {
        status: isFromMe ? 'REQUEST_SENT' : 'REQUEST_RECEIVED',
        friendshipId: friendship.id,
      };
    }
    return { status: 'NONE' };
  }
}
