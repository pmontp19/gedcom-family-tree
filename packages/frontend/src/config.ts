/** The AI panel, and the upload of the tree to the backend that feeds it, are opt-in. */
export const AI_ENABLED = import.meta.env.VITE_AI_ENABLED === 'true';

/** The AI backend (packages/backend). */
export const API_URL = 'http://localhost:3001';
