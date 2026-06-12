// Materia destino elegida en el paso 1 y arrastrada al preview. `existing` lleva el id (commit con
// subjectId); `new` lleva solo el nombre (commit con subjectName → la materia se crea al confirmar).
export type ImportTarget =
  | { kind: 'existing'; subjectId: string; name: string }
  | { kind: 'new'; name: string };
