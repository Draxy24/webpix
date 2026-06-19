import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class PendingSeenDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(120)
  @IsString({ each: true })
  @MaxLength(20, { each: true })
  periods?: string[];
}
