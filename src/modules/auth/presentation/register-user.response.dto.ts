import { ApiProperty } from '@nestjs/swagger';

export class RegisterUserResponseDto {
  @ApiProperty({ example: 'maria@example.com', format: 'email' })
  email!: string;

  @ApiProperty({ example: '9c2d7d72-5b8f-4e3d-8d31-2afc8f3b5e9d' })
  id!: string;

  @ApiProperty({ example: 'Maria Silva', maxLength: 100, minLength: 2 })
  name!: string;
}
