import express from "express";
import { errorHandler, notFoundHandler } from "./middlewares/error-handler.js";
import { apiRouter } from "./routes/index.js";

export const app = express();

app.use(express.json());
app.use(apiRouter);

app.use(notFoundHandler);
app.use(errorHandler);
