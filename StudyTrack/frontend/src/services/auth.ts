import { MOCK, req } from "./http";
import { saveSession, type AuthResult } from "./session";

export { ApiError } from "./http";
export { getSession, logout, type User } from "./session";

/** POST /api/auth/register  { name, email, password }  ou  POST /api/auth/login  { email, password }
    Réponse attendue : { token, user: { id, name, email } } (voir docs/API_CONTRACT.md). */
export async function authenticate(path: "register" | "login", body: Record<string, string>) {
  const result = MOCK
    ? await (await import("./mock")).mockAuth(path, body)
    : await req<AuthResult>(`/auth/${path}`, { method: "POST", body: JSON.stringify(body) }, false);
  saveSession(result);
  return result.user;
}
