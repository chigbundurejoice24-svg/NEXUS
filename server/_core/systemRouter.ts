import { z } from "zod";
import { notifyOwner } from "./notification";
import type { NotificationPayload } from "./notification";
import { adminProcedure, publicProcedure, router } from "./trpc";

export const systemRouter = router({
  health: publicProcedure
    .input(z.object({ timestamp: z.number().min(0) }))
    .query(() => ({ ok: true })),

  notifyOwner: adminProcedure
    .input(z.object({
      title: z.string().min(1, "title is required"),
      content: z.string().min(1, "content is required"),
    }))
    .mutation(async ({ input }) => {
      const payload: NotificationPayload = {
        title: input.title,
        content: input.content,
      };
      const delivered = await notifyOwner(payload);
      return { success: delivered } as const;
    }),
});
