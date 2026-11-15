import { z } from "zod";

// Date du paiement facultative : sans elle, c'est maintenant.
export const markPaidBody = z.object({
  paidAt: z.iso.datetime({ offset: true, error: "Indique la date du paiement." }).optional(),
});

export type MarkPaidBody = z.infer<typeof markPaidBody>;
