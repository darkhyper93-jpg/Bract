// Estado de navegación para abrir el chat enfocado en un tema — deep-link desde el Temario (§8.7).
// SOLO frontend: no toca el contrato ni el streaming del chat. ChatPage crea una sesión titulada con
// el tema y auto-envía un primer mensaje que lo nombra (el backend ya conoce el árbol completo).
export interface ChatFocusTopic {
  name: string;
  subjectName: string;
}

export interface ChatLocationState {
  focusTopic?: ChatFocusTopic;
}
