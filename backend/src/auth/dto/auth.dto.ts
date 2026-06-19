import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  nickname!: string;

  @IsString()
  @MinLength(6)
  @MaxLength(72)
  password!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  country?: string;
}

export class LoginDto {
  @IsString()
  @IsNotEmpty()
  emailOrPhone!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;
}

export class VerifyEmailDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  code!: string;
}

export class VerifyPhoneDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  code!: string;
}

export class ForgotPasswordDto {
  @IsString()
  @IsNotEmpty()
  emailOrPhone!: string;
}

export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty()
  emailOrPhone!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  code!: string;

  @IsString()
  @MinLength(6)
  @MaxLength(72)
  newPassword!: string;
}
