import {
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  Matches,
  IsNotEmpty,
  IsEmail,
} from 'class-validator';

export class UpdateMeDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  profilePic?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  country?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(20)
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: 'El nickname solo puede tener letras, números y guion bajo',
  })
  nickname?: string;
}

export class AddEmailDto {
  @IsEmail()
  email!: string;
}

export class AddPhoneDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  phone!: string;
}

export class VerifyContactDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  code!: string;
}
