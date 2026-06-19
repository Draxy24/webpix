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

export class CreatePublicationDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsInt() @Min(0) @Max(COORD_MAX) x1!: number;
  @IsInt() @Min(0) @Max(COORD_MAX) y1!: number;
  @IsInt() @Min(0) @Max(COORD_MAX) x2!: number;
  @IsInt() @Min(0) @Max(COORD_MAX) y2!: number;
}

export class ReactDto {
  @IsIn(['LIKE', 'DISLIKE'])
  type!: 'LIKE' | 'DISLIKE';
}

export class AddCommentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  content!: string;
}
