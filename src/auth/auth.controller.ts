import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ApiErrorResponses } from '../task-management/common/decorators/api-error-responses.decorator';
import { CreateUserDto } from '../task-management/users/dto/create-user.dto';
import { UserResponseDto } from '../task-management/users/dto/user-response.dto';
import { User } from '../task-management/users/entities/user.entity';
import { AuthService } from './auth.service';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { AuthResponseDto, AuthTokensDto } from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Public()
  @ApiOperation({
    summary: 'Đăng ký tài khoản',
    description: [
      'Tạo tài khoản mới (luôn có `role = member`) và trả về cặp token để đăng nhập ngay.',
      '',
      'Ràng buộc dữ liệu giống `POST /task-management/users`.',
    ].join('\n'),
  })
  @ApiCreatedResponse({ type: AuthResponseDto })
  @ApiErrorResponses({
    400: 'Dữ liệu đầu vào không hợp lệ.',
    409: 'Email đã được sử dụng.',
  })
  async register(@Body() dto: CreateUserDto): Promise<AuthResponseDto> {
    const { user, tokens } = await this.authService.register(dto);
    return { ...tokens, user: UserResponseDto.fromEntity(user) };
  }

  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Đăng nhập',
    description: [
      'Xác thực bằng email + mật khẩu, trả về `accessToken` (ngắn hạn) và `refreshToken` (dài hạn).',
      '',
      'Gửi access token qua header `Authorization: Bearer <accessToken>` khi gọi các API được bảo vệ.',
    ].join('\n'),
  })
  @ApiOkResponse({ type: AuthResponseDto })
  @ApiErrorResponses({
    400: 'Dữ liệu đầu vào không hợp lệ.',
    401: 'Sai email hoặc mật khẩu.',
    403: 'Tài khoản đã bị khoá (`isActive = false`).',
  })
  async login(@Body() dto: LoginDto): Promise<AuthResponseDto> {
    const { user, tokens } = await this.authService.login(dto);
    return { ...tokens, user: UserResponseDto.fromEntity(user) };
  }

  @Post('refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Làm mới token',
    description:
      'Đổi `refreshToken` còn hiệu lực lấy cặp token mới. Token bị từ chối nếu người dùng đã bị xoá, bị khoá hoặc đã đổi mật khẩu.',
  })
  @ApiOkResponse({ type: AuthTokensDto })
  @ApiErrorResponses({
    400: '`refreshToken` không phải JWT.',
    401: 'Refresh token không hợp lệ hoặc đã hết hạn.',
  })
  refresh(@Body() dto: RefreshTokenDto): Promise<AuthTokensDto> {
    return this.authService.refresh(dto.refreshToken);
  }

  @Get('me')
  @ApiOperation({
    summary: 'Thông tin người dùng hiện tại',
    description: 'Trả về thông tin của người dùng sở hữu access token.',
  })
  @ApiOkResponse({ type: UserResponseDto })
  me(@CurrentUser() user: User): UserResponseDto {
    return UserResponseDto.fromEntity(user);
  }
}
