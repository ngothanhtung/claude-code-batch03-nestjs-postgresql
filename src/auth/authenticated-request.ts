import type { Request } from 'express';
import { User } from '../task-management/users/entities/user.entity';

export type AuthenticatedRequest = Request & { user: User };
