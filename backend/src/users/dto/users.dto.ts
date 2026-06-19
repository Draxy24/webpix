import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateMeDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  profilePic?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  country?: string;
}
