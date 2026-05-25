import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ReportStatus, ReportType } from '@prisma/client';

@Injectable()
export class ModerationService {
  constructor(private prisma: PrismaService) {}

  private async logAction(
    moderatorId: number,
    action: string,
    targetUserId: number | null,
    details: string | null,
  ) {
    await this.prisma.moderationAction.create({
      data: { moderatorId, action, targetUserId, details },
    });
  }

  // ---- Reportes (usuarios) ----

  async createReport(
    reporterId: number,
    data: {
      type: 'USER' | 'PUBLICATION' | 'COMMENT' | 'BUG';
      targetUserId?: number;
      targetNickname?: string;
      publicationId?: number;
      commentId?: number;
      reason: string;
      details?: string;
    },
  ) {
    if (data.type === 'USER') {
      let targetId = data.targetUserId;
      if (!targetId && data.targetNickname) {
        const t = await this.prisma.user.findUnique({
          where: { nickname: data.targetNickname },
        });
        if (!t) throw new NotFoundException('Usuario no encontrado');
        targetId = t.id;
      }
      if (!targetId)
        throw new BadRequestException('Falta el usuario a reportar');
      if (targetId === reporterId)
        throw new BadRequestException('No puedes reportarte a ti mismo');
      data.targetUserId = targetId;
    } else if (data.type === 'PUBLICATION') {
      if (!data.publicationId)
        throw new BadRequestException('Falta la publicación a reportar');
      const pub = await this.prisma.publication.findUnique({
        where: { id: data.publicationId },
      });
      if (!pub) throw new NotFoundException('Publicación no encontrada');
    } else if (data.type === 'COMMENT') {
      if (!data.commentId)
        throw new BadRequestException('Falta el comentario a reportar');
      const comment = await this.prisma.publicationComment.findUnique({
        where: { id: data.commentId },
      });
      if (!comment) throw new NotFoundException('Comentario no encontrado');
    } else if (data.type === 'BUG') {
      if (!data.details || data.details.trim().length === 0) {
        throw new BadRequestException('Debes explicar cómo reproducir el bug');
      }
    }

    if (data.type !== 'BUG') {
      const existing = await this.prisma.report.findFirst({
        where: {
          reporterId,
          type: data.type,
          status: 'PENDING',
          targetUserId: data.targetUserId ?? undefined,
          publicationId: data.publicationId ?? undefined,
          commentId: data.commentId ?? undefined,
        },
      });
      if (existing)
        throw new BadRequestException(
          'Ya reportaste esto y está pendiente de revisión',
        );
    }

    await this.prisma.report.create({
      data: {
        type: data.type,
        reporterId,
        targetUserId: data.targetUserId,
        publicationId: data.publicationId,
        commentId: data.commentId,
        reason: data.reason,
        details: data.details,
      },
    });

    return { success: true };
  }

  // ---- Reportes (admins) ----

  async listReports(status?: string, type?: string) {
    const where: { status?: ReportStatus; type?: ReportType } = {};
    if (status) where.status = status as ReportStatus;
    if (type) where.type = type as ReportType;

    const reports = await this.prisma.report.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    const userIds = new Set<number>();
    reports.forEach((r) => {
      userIds.add(r.reporterId);
      if (r.targetUserId) userIds.add(r.targetUserId);
    });
    const users = await this.prisma.user.findMany({
      where: { id: { in: [...userIds] } },
      select: { id: true, nickname: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u.nickname]));

    return reports.map((r) => ({
      id: r.id,
      type: r.type,
      reason: r.reason,
      details: r.details,
      status: r.status,
      createdAt: r.createdAt,
      reporterNickname: userMap.get(r.reporterId) ?? 'desconocido',
      targetUserId: r.targetUserId,
      targetNickname: r.targetUserId
        ? (userMap.get(r.targetUserId) ?? null)
        : null,
      publicationId: r.publicationId,
      commentId: r.commentId,
    }));
  }

  async resolveReport(reportId: number, adminId: number) {
    const report = await this.prisma.report.findUnique({
      where: { id: reportId },
    });
    if (!report) throw new NotFoundException('Reporte no encontrado');
    await this.prisma.report.update({
      where: { id: reportId },
      data: {
        status: 'RESOLVED',
        resolvedAt: new Date(),
        resolvedById: adminId,
      },
    });
    await this.logAction(
      adminId,
      'RESOLVE_REPORT',
      report.targetUserId,
      `Reporte #${reportId}`,
    );
    return { success: true };
  }

  async dismissReport(reportId: number, adminId: number) {
    const report = await this.prisma.report.findUnique({
      where: { id: reportId },
    });
    if (!report) throw new NotFoundException('Reporte no encontrado');
    await this.prisma.report.update({
      where: { id: reportId },
      data: {
        status: 'DISMISSED',
        resolvedAt: new Date(),
        resolvedById: adminId,
      },
    });
    await this.logAction(
      adminId,
      'DISMISS_REPORT',
      report.targetUserId,
      `Reporte #${reportId}`,
    );
    return { success: true };
  }

  // ---- Baneos (admins) ----

  async banUser(
    adminId: number,
    userId: number,
    durationDays: number | null,
    reason: string,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    if (user.isAdmin)
      throw new BadRequestException('No puedes banear a un administrador');

    const permanent = durationDays === null;
    const bannedUntil = permanent
      ? null
      : new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);

    await this.prisma.user.update({
      where: { id: userId },
      data: { banPermanent: permanent, bannedUntil, banReason: reason },
    });

    await this.logAction(
      adminId,
      permanent ? 'BAN_PERMANENT' : 'BAN_TEMP',
      userId,
      reason,
    );
    return { success: true };
  }

  async modifyBan(
    adminId: number,
    userId: number,
    durationDays: number | null,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    const permanent = durationDays === null;
    const bannedUntil = permanent
      ? null
      : new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);

    await this.prisma.user.update({
      where: { id: userId },
      data: { banPermanent: permanent, bannedUntil },
    });
    await this.logAction(
      adminId,
      'MODIFY_BAN',
      userId,
      permanent ? 'Permanente' : `${durationDays} días`,
    );
    return { success: true };
  }

  async unbanUser(adminId: number, userId: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    await this.prisma.user.update({
      where: { id: userId },
      data: { banPermanent: false, bannedUntil: null, banReason: null },
    });
    await this.logAction(adminId, 'UNBAN', userId, null);
    return { success: true };
  }

  // ---- Borrado de contenido (admins) ----

  async deletePublication(adminId: number, publicationId: number) {
    const pub = await this.prisma.publication.findUnique({
      where: { id: publicationId },
    });
    if (!pub) throw new NotFoundException('Publicación no encontrada');
    await this.prisma.publication.delete({ where: { id: publicationId } });
    await this.logAction(
      adminId,
      'DELETE_PUBLICATION',
      pub.userId,
      `Publicación #${publicationId}`,
    );
    return { success: true };
  }

  async deleteComment(adminId: number, commentId: number) {
    const comment = await this.prisma.publicationComment.findUnique({
      where: { id: commentId },
    });
    if (!comment) throw new NotFoundException('Comentario no encontrado');
    await this.prisma.publicationComment.delete({ where: { id: commentId } });
    await this.logAction(
      adminId,
      'DELETE_COMMENT',
      comment.userId,
      `Comentario #${commentId}`,
    );
    return { success: true };
  }

  // ---- Audit log (admins) ----

  async getModerationLog() {
    const actions = await this.prisma.moderationAction.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const userIds = new Set<number>();
    actions.forEach((a) => {
      userIds.add(a.moderatorId);
      if (a.targetUserId) userIds.add(a.targetUserId);
    });
    const users = await this.prisma.user.findMany({
      where: { id: { in: [...userIds] } },
      select: { id: true, nickname: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u.nickname]));

    return actions.map((a) => ({
      id: a.id,
      action: a.action,
      moderator: userMap.get(a.moderatorId) ?? 'desconocido',
      targetNickname: a.targetUserId
        ? (userMap.get(a.targetUserId) ?? null)
        : null,
      details: a.details,
      createdAt: a.createdAt,
    }));
  }
}
