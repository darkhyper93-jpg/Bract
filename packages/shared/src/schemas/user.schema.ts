import { z } from 'zod';
import { Role, UserStatus } from '../types/user.types';

export const GetUsersQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional(),
  role: z.nativeEnum(Role).optional(),
  status: z.nativeEnum(UserStatus).optional(),
});

export type GetUsersQuery = z.infer<typeof GetUsersQuerySchema>;

export const userListQuerySchema = GetUsersQuerySchema;
export type UserListQuery = z.infer<typeof userListQuerySchema>;

export const updateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  avatarUrl: z.string().url().optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string().min(1),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const updateUserRoleSchema = z.object({
  role: z.nativeEnum(Role),
});

export type UpdateUserRoleInput = z.infer<typeof updateUserRoleSchema>;

export const updateUserStatusSchema = z.object({
  status: z.nativeEnum(UserStatus),
});

export type UpdateUserStatusInput = z.infer<typeof updateUserStatusSchema>;
