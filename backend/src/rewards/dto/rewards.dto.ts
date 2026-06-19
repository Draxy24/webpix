import { IsInt, IsPositive } from 'class-validator';

export class CosmeticDto {
  @IsInt()
  @IsPositive()
  cosmeticId!: number;
}
