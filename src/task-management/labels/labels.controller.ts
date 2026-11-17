import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { CreateLabelDto } from './dto/create-label.dto';
import { LabelResponseDto } from './dto/label-response.dto';
import { UpdateLabelDto } from './dto/update-label.dto';
import { LabelsService } from './labels.service';

@Controller('task-management/projects/:projectId/labels')
export class LabelsController {
  constructor(private readonly labelsService: LabelsService) {}

  @Post()
  async create(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Body() dto: CreateLabelDto,
  ): Promise<LabelResponseDto> {
    return LabelResponseDto.fromEntity(
      await this.labelsService.create(projectId, dto),
    );
  }

  @Get()
  async findAll(
    @Param('projectId', ParseIntPipe) projectId: number,
  ): Promise<LabelResponseDto[]> {
    const labels = await this.labelsService.findAll(projectId);
    return labels.map((label) => LabelResponseDto.fromEntity(label));
  }

  @Get(':labelId')
  async findOne(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('labelId', ParseIntPipe) labelId: number,
  ): Promise<LabelResponseDto> {
    return LabelResponseDto.fromEntity(
      await this.labelsService.findOne(projectId, labelId),
    );
  }

  @Patch(':labelId')
  async update(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('labelId', ParseIntPipe) labelId: number,
    @Body() dto: UpdateLabelDto,
  ): Promise<LabelResponseDto> {
    return LabelResponseDto.fromEntity(
      await this.labelsService.update(projectId, labelId, dto),
    );
  }

  @Delete(':labelId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('labelId', ParseIntPipe) labelId: number,
  ): Promise<void> {
    await this.labelsService.remove(projectId, labelId);
  }
}
