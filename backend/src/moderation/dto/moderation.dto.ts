import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const COORD_MAX = 999;

export class CreateReportDto {
  @IsIn(['USER', 'PUBLICATION', 'COMMENT', 'BUG', 'CANVAS'])
  type!: 'USER' | 'PUBLICATION' | 'COMMENT' | 'BUG' | 'CANVAS';

  @IsOptional() @IsInt() targetUserId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  targetNickname?: string;

  @IsOptional() @IsInt() publicationId?: number;
  @IsOptional() @IsInt() commentId?: number;

  @IsOptional() @IsInt() @Min(0) @Max(COORD_MAX) x1?: number;
  @IsOptional() @IsInt() @Min(0) @Max(COORD_MAX) y1?: number;
  @IsOptional() @IsInt() @Min(0) @Max(COORD_MAX) x2?: number;
  @IsOptional() @IsInt() @Min(0) @Max(COORD_MAX) y2?: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  reason!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  details?: string;
}

export class BanUserDto {
  @IsInt() userId!: number;

  @IsOptional() @IsInt() @Min(1) durationDays?: number | null;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}

export class ModifyBanDto {
  @IsOptional() @IsInt() @Min(1) durationDays?: number | null;
}
