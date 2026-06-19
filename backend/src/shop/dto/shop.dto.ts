import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';

export class BuyDto {
  @IsInt()
  @IsPositive()
  cosmeticId!: number;
}

export class BuyPaletteDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  paletteKey!: string;
}

export class BuyBitsDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  packageKey!: string;
}

export class SubscribeDto {
  @IsIn(['PLUS', 'PREMIUM'])
  tier!: 'PLUS' | 'PREMIUM';
}
