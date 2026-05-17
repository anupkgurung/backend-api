import type { Request } from "express";

/** Express 5 route params may be string | string[] */
export function routeParam(req: Request, name: string): string {
  const value = req.params[name];
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}
