import { z } from 'zod';

// Schema de formulario de flashcard (RHF + zodResolver). Espeja los límites del schema de API
// de @bract/shared (createFlashcardSchema): question ≤1000, answer ≤2000. El `topicId` lo aporta
// el contexto de la vista (no es un campo del form).
export const flashcardFormSchema = z.object({
  question: z.string().trim().min(1, 'required').max(1000, 'tooLong'),
  answer: z.string().trim().min(1, 'required').max(2000, 'tooLong'),
});

export type FlashcardFormValues = z.infer<typeof flashcardFormSchema>;
