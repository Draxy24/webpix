import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const COORD_MAX = 999;

export class QuoteSpaceDto {
  @IsInt() @Min(0) @Max(COORD_MAX) x1!: number;
  @IsInt() @Min(0) @Max(COORD_MAX) y1!: number;
  @IsInt() @Min(0) @Max(COORD_MAX) x2!: number;
  @IsInt() @Min(0) @Max(COORD_MAX) y2!: number;
}

export class PurchaseSpaceDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  name?: string;

  @IsInt() @Min(0) @Max(COORD_MAX) x1!: number;
  @IsInt() @Min(0) @Max(COORD_MAX) y1!: number;
  @IsInt() @Min(0) @Max(COORD_MAX) x2!: number;
  @IsInt() @Min(0) @Max(COORD_MAX) y2!: number;

  @IsIn(['OWNER_ONLY', 'FRIENDS', 'SPECIFIC'])
  accessMode!: 'OWNER_ONLY' | 'FRIENDS' | 'SPECIFIC';

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  memberNicknames?: string[];
}

export class UpdateAccessDto {
  @IsOptional()
  @IsIn(['OWNER_ONLY', 'FRIENDS', 'SPECIFIC'])
  accessMode?: 'OWNER_ONLY' | 'FRIENDS' | 'SPECIFIC';

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  addNicknames?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  removeNicknames?: string[];
}
