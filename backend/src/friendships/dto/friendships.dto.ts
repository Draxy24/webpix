import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class SendFriendRequestDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  receiverNickname!: string;
}
