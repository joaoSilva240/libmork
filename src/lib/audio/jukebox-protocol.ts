// =============================================================================
// Libmork — Audio: Contrato do protocolo de jukebox (Issue #60)
// =============================================================================
// Módulo puro compartilhado entre o cliente (TypeScript) e o servidor
// (server.js CommonJS). Os nomes dos eventos DEVEM ser exatamente estes —
// use-os verbatim nos handlers do server.js.
//
// Design: volume é LOCAL por usuário; eventos sincronizados são
// add/play/pause/loop/remove; late-joiners recebem o snapshot audio:track-state.
// Suporta execução simultânea através de playingTrackIds (Set/Array).

import { z } from "zod";

// ================================== Eventos =================================

export const AUDIO_EVENTS = {
  TRACK_ADD: "audio:track-add",
  TRACK_PLAY: "audio:track-play",
  TRACK_PAUSE: "audio:track-pause",
  TRACK_LOOP: "audio:track-loop",
  TRACK_REMOVE: "audio:track-remove",
  TRACK_STATE: "audio:track-state", // snapshot para late-joiners (servidor -> cliente)
} as const;

export interface AudioTrack {
  id: string; // videoId do YouTube (11 chars)
  title: string; // título exibível; se desconhecido, usar o videoId
  addedBy: string; // userId do mestre
  addedAt: string; // ISO timestamp
}

export interface AudioTrackAddPayload {
  campaignId: string;
  actorId?: string;
  actorName: string; // nome do mestre (para log/toast)
  track: AudioTrack;
}

export interface AudioTrackPlayPayload {
  campaignId: string;
  trackId: string;
  playingAt: number; // Date.now() no mestre — clientes fazem seekTo( (Date.now()-playingAt)/1000 )
}

export interface AudioTrackPausePayload {
  campaignId: string;
  trackId: string;
}
export interface AudioTrackRemovePayload {
  campaignId: string;
  trackId: string;
}
export interface AudioTrackLoopPayload {
  campaignId: string;
  trackId: string;
  loop: boolean;
}

// Snapshot completo para reconstrução do estado (late-joiners + reconexão)
export interface AudioTrackStatePayload {
  campaignId: string;
  tracks: AudioTrack[];
  playingTrackIds?: string[]; // Faixas em reprodução simultânea (Issue #60)
  playingTrackId?: string | null; // Retrocompatibilidade (primeira faixa ou null)
  playingAt?: number | null; // epoch de início da primeira faixa em play (null se pausada)
  loopTrackIds: string[]; // versões dinâmicas do estado de loop
}

// Payload emitido no socket do CLIENTE para o servidor
export type AudioTrackEventPayload =
  | AudioTrackAddPayload
  | AudioTrackPlayPayload
  | AudioTrackPausePayload
  | AudioTrackLoopPayload
  | AudioTrackRemovePayload;

// ============================== Zod (servidor) ==============================

const YOUTUBE_ID_REGEX = /^[A-Za-z0-9_-]{11}$/;

export const audioTrackSchema = z.object({
  id: z.string().regex(YOUTUBE_ID_REGEX, "ID de vídeo do YouTube inválido"),
  title: z.string(),
  addedBy: z.string(),
  addedAt: z.iso.datetime(),
});

export const audioTrackAddSchema = z.object({
  campaignId: z.string().min(1, "campaignId é obrigatório"),
  actorId: z.string().optional(),
  actorName: z.string(),
  track: audioTrackSchema,
});

export const audioTrackPlaySchema = z.object({
  campaignId: z.string().min(1, "campaignId é obrigatório"),
  trackId: z.string().min(1, "trackId é obrigatório"),
  playingAt: z.number(),
});

export const audioTrackPauseSchema = z.object({
  campaignId: z.string().min(1, "campaignId é obrigatório"),
  trackId: z.string().min(1, "trackId é obrigatório"),
});

export const audioTrackLoopSchema = z.object({
  campaignId: z.string().min(1, "campaignId é obrigatório"),
  trackId: z.string().min(1, "trackId é obrigatório"),
  loop: z.boolean({ message: "loop deve ser um booleano" }),
});

export const audioTrackRemoveSchema = z.object({
  campaignId: z.string().min(1, "campaignId é obrigatório"),
  trackId: z.string().min(1, "trackId é obrigatório"),
});
