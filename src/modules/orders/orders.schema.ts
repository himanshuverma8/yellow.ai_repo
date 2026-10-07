import { z } from "zod";
import { idSchema } from "../../shared/schemas.js";

export const orderParamsSchema = z.object({ order_id: idSchema });
