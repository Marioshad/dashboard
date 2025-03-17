import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";

export async function registerRoutes(app: Express): Promise<Server> {
  // Add ping endpoint for health check
  app.get('/ping', (_req, res) => {
    res.status(200).send('pong');
  });

  setupAuth(app);

  const httpServer = createServer(app);
  return httpServer;
}