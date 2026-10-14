import type {
  InteractionChannel,
  InteractionType,
} from "../../generated/prisma/enums";

export const INTERACTION_TYPE_LABELS: Record<InteractionType, string> = {
  FIRST_CONTACT: "Primeiro contato",
  FOLLOW_UP: "Acompanhamento",
  RESPONSE_RECEIVED: "Resposta recebida",
  MEETING: "Reunião",
  OTHER: "Outro",
};

export const INTERACTION_CHANNEL_LABELS: Record<InteractionChannel, string> = {
  WHATSAPP: "WhatsApp",
  INSTAGRAM: "Instagram",
  EMAIL: "E-mail",
  PHONE: "Telefone",
  OTHER: "Outro",
};
