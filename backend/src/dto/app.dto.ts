import {
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const COORD_MAX = 999; // lienzo 1000×1000 (0–999)

export class SetPixelDto {
  @IsInt() @Min(0) @Max(COORD_MAX) x!: number;
  @IsInt() @Min(0) @Max(COORD_MAX) y!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  color!: string;
}

export class EraseDto {
  @IsInt() @Min(0) @Max(COORD_MAX) x!: number;
  @IsInt() @Min(0) @Max(COORD_MAX) y!: number;
}

export class EraseAreaDto {
  @IsInt() @Min(0) @Max(COORD_MAX) x1!: number;
  @IsInt() @Min(0) @Max(COORD_MAX) y1!: number;
  @IsInt() @Min(0) @Max(COORD_MAX) x2!: number;
  @IsInt() @Min(0) @Max(COORD_MAX) y2!: number;
}
