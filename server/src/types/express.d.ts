import type { AuthContext } from '../lib/users';

declare global {
  namespace Express {
    interface Request {
      /** Set by the authenticate middleware when a valid session cookie is present. */
      auth?: AuthContext;
    }
  }
}

export {};
