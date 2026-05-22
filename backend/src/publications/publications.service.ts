import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

const MIN_AREA = 64; // equivalente a 8x8 en superficie total
const MIN_SIDE = 4; // evita líneas absurdamente delgadas (ej. 64x1)
const MIN_USER_PIXELS = 15;
const MIN_OWNERSHIP_RATIO = 0.6;
const MAX_COMMENT_LENGTH = 100;
const MAX_TITLE_LENGTH = 60;

@Injectable()
export class PublicationsService {
  constructor(private prisma: PrismaService) {}

  async create(
    userId: number,
    data: { title?: string; x1: number; y1: number; x2: number; y2: number },
  ) {
    const x1 = Math.min(data.x1, data.x2);
    const y1 = Math.min(data.y1, data.y2);
    const x2 = Math.max(data.x1, data.x2);
    const y2 = Math.max(data.y1, data.y2);

    const width = x2 - x1 + 1;
    const height = y2 - y1 + 1;
    const area = width * height;

    if (width < MIN_SIDE || height < MIN_SIDE || area < MIN_AREA) {
      throw new BadRequestException(
        `El área debe tener al menos ${MIN_AREA} píxeles en total y mínimo ${MIN_SIDE} de cada lado`,
      );
    }

    if (data.title && data.title.length > MAX_TITLE_LENGTH) {
      throw new BadRequestException(
        `El título no puede tener más de ${MAX_TITLE_LENGTH} caracteres`,
      );
    }

    const pixels = await this.prisma.pixel.findMany({
      where: { x: { gte: x1, lte: x2 }, y: { gte: y1, lte: y2 } },
    });

    if (pixels.length === 0) {
      throw new BadRequestException('El área seleccionada está vacía');
    }

    const userPixels = pixels.filter((p) => p.userId === userId);

    if (userPixels.length < MIN_USER_PIXELS) {
      throw new BadRequestException(
        `Debes haber pintado al menos ${MIN_USER_PIXELS} píxeles en esta área`,
      );
    }

    const ownershipRatio = userPixels.length / pixels.length;
    if (ownershipRatio < MIN_OWNERSHIP_RATIO) {
      throw new BadRequestException(
        `Debes ser autor de al menos el ${MIN_OWNERSHIP_RATIO * 100}% de los píxeles pintados en el área. Actualmente: ${Math.round(ownershipRatio * 100)}%`,
      );
    }

    const pixelData: Record<string, string> = {};
    for (const pixel of pixels) {
      pixelData[`${pixel.x},${pixel.y}`] = pixel.color;
    }

    return this.prisma.publication.create({
      data: {
        userId,
        title: data.title || null,
        x1,
        y1,
        x2,
        y2,
        pixelData: pixelData as Prisma.InputJsonValue,
      },
    });
  }

  async listByUser(nickname: string) {
    const user = await this.prisma.user.findUnique({ where: { nickname } });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    const publications = await this.prisma.publication.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        reactions: { select: { type: true } },
        _count: { select: { comments: true } },
      },
    });

    return publications.map((p) => ({
      id: p.id,
      title: p.title,
      x1: p.x1,
      y1: p.y1,
      x2: p.x2,
      y2: p.y2,
      pixelData: p.pixelData,
      createdAt: p.createdAt,
      likes: p.reactions.filter((r) => r.type === 'LIKE').length,
      dislikes: p.reactions.filter((r) => r.type === 'DISLIKE').length,
      commentCount: p._count.comments,
    }));
  }

  async findById(id: number, viewerId: number | null) {
    const publication = await this.prisma.publication.findUnique({
      where: { id },
      include: {
        user: { select: { nickname: true, profilePic: true } },
        reactions: { select: { userId: true, type: true } },
        comments: {
          orderBy: { createdAt: 'asc' },
          include: { user: { select: { nickname: true, profilePic: true } } },
        },
      },
    });

    if (!publication) throw new NotFoundException('Publicación no encontrada');

    const likes = publication.reactions.filter((r) => r.type === 'LIKE').length;
    const dislikes = publication.reactions.filter(
      (r) => r.type === 'DISLIKE',
    ).length;
    const myReaction = viewerId
      ? (publication.reactions.find((r) => r.userId === viewerId)?.type ?? null)
      : null;

    return {
      id: publication.id,
      title: publication.title,
      x1: publication.x1,
      y1: publication.y1,
      x2: publication.x2,
      y2: publication.y2,
      pixelData: publication.pixelData,
      createdAt: publication.createdAt,
      author: publication.user,
      likes,
      dislikes,
      myReaction,
      comments: publication.comments.map((c) => ({
        id: c.id,
        content: c.content,
        createdAt: c.createdAt,
        author: c.user,
        isMine: c.userId === viewerId,
      })),
    };
  }

  async delete(publicationId: number, userId: number) {
    const publication = await this.prisma.publication.findUnique({
      where: { id: publicationId },
    });
    if (!publication) throw new NotFoundException('Publicación no encontrada');
    if (publication.userId !== userId)
      throw new ForbiddenException('No puedes eliminar esta publicación');

    await this.prisma.publication.delete({ where: { id: publicationId } });
    return { success: true };
  }

  async react(publicationId: number, userId: number, type: 'LIKE' | 'DISLIKE') {
    const publication = await this.prisma.publication.findUnique({
      where: { id: publicationId },
    });
    if (!publication) throw new NotFoundException('Publicación no encontrada');

    const existing = await this.prisma.publicationReaction.findUnique({
      where: { publicationId_userId: { publicationId, userId } },
    });

    if (existing) {
      if (existing.type === type) {
        await this.prisma.publicationReaction.delete({
          where: { id: existing.id },
        });
        return { reaction: null };
      }
      await this.prisma.publicationReaction.update({
        where: { id: existing.id },
        data: { type },
      });
      return { reaction: type };
    }

    await this.prisma.publicationReaction.create({
      data: { publicationId, userId, type },
    });
    return { reaction: type };
  }

  async addComment(publicationId: number, userId: number, content: string) {
    const trimmed = content.trim();
    if (trimmed.length === 0 || trimmed.length > MAX_COMMENT_LENGTH) {
      throw new BadRequestException(
        `El comentario debe tener entre 1 y ${MAX_COMMENT_LENGTH} caracteres`,
      );
    }

    const publication = await this.prisma.publication.findUnique({
      where: { id: publicationId },
    });
    if (!publication) throw new NotFoundException('Publicación no encontrada');

    const comment = await this.prisma.publicationComment.create({
      data: { publicationId, userId, content: trimmed },
      include: { user: { select: { nickname: true, profilePic: true } } },
    });

    return {
      id: comment.id,
      content: comment.content,
      createdAt: comment.createdAt,
      author: comment.user,
      isMine: true,
    };
  }

  async deleteComment(commentId: number, userId: number) {
    const comment = await this.prisma.publicationComment.findUnique({
      where: { id: commentId },
    });
    if (!comment) throw new NotFoundException('Comentario no encontrado');
    if (comment.userId !== userId)
      throw new ForbiddenException('No puedes eliminar este comentario');

    await this.prisma.publicationComment.delete({ where: { id: commentId } });
    return { success: true };
  }
}
