import {
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  MaxLength,
  Min,
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

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

class BatchCellDto {
  @IsInt() @Min(0) @Max(999) x: number;
  @IsInt() @Min(0) @Max(999) y: number;
}

export class PaintBatchDto {
  @IsString() @MaxLength(32) color: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => BatchCellDto)
  cells: BatchCellDto[];
}
