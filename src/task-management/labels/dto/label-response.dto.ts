import { Label } from '../entities/label.entity';

export class LabelResponseDto {
  id: number;
  projectId: number;
  name: string;
  color: string;
  createdAt: Date;

  static fromEntity(label: Label): LabelResponseDto {
    const dto = new LabelResponseDto();
    dto.id = label.id;
    dto.projectId = label.projectId;
    dto.name = label.name;
    dto.color = label.color;
    dto.createdAt = label.createdAt;
    return dto;
  }
}
