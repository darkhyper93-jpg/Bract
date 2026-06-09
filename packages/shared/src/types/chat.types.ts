// Producto — Estudio con IA · Chat de estudio (tutor con contexto del estudiante) — README §3.3.

export enum ChatRole {
  USER = 'USER',
  ASSISTANT = 'ASSISTANT',
  SYSTEM = 'SYSTEM', // el system-prompt en vivo lo arma el Agente B; SYSTEM permite persistirlo
}

export interface ChatSession {
  id: string;
  userId: string;
  title: string | null; // derivado del 1er mensaje (editable)
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: ChatRole;
  content: string;
  createdAt: string;
}

// Sesión + hilo ordenado (respuesta de GET /chat/sessions/:id).
export interface ChatSessionWithMessages extends ChatSession {
  messages: ChatMessage[];
}
