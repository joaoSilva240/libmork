import { z } from "zod";

export const createEncounterSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
});

export const updateEncounterSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  isActive: z.boolean().optional(),
});

export const addParticipantSchema = z.object({
  actorType: z.enum(["character", "npc"]),
  actorId: z.string().uuid(),
  initiative: z.number().int().optional(),
});
