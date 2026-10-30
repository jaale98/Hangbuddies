import { z } from 'zod';
import { AVATAR_IDS } from './avatars';
import { cleanName } from './names';
import { CODE_ALPHABET, CODE_LENGTH, DIFFICULTIES, NAME_MAX } from './constants';


export const nameSchema = z
  .string()
  .transform(cleanName)
  .pipe(z.string().min(1).max(NAME_MAX));

export const codeSchema = z
  .string()
  .transform((s) => s.trim().toUpperCase())
  .pipe(z.string().length(CODE_LENGTH).regex(new RegExp(`^[${CODE_ALPHABET}]+$`)));

export const avatarSchema = z.enum(AVATAR_IDS as [string, ...string[]]);
export const difficultySchema = z.enum(DIFFICULTIES as ['easy', 'medium', 'hard']);
export const letterSchema = z
  .string()
  .transform((s) => s.toUpperCase())
  .pipe(z.string().regex(/^[A-Z]$/));

export const schemas = {
  create: z.object({ name: nameSchema, avatarId: avatarSchema }),
  createSolo: z.object({ name: nameSchema, avatarId: avatarSchema, difficulty: difficultySchema }),
  check: z.object({ code: codeSchema }),
  join: z.object({ code: codeSchema, name: nameSchema, avatarId: avatarSchema }),
  resume: z.object({ code: codeSchema, token: z.string().min(10).max(100) }),
  update: z.object({ name: nameSchema.optional(), avatarId: avatarSchema.optional() }),
  difficulty: z.object({ difficulty: difficultySchema }),
  guess: z.object({ letter: letterSchema, round: z.number().int().min(0).max(100) }),
};
