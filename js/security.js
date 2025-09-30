import { compareSync, hashSync } from 'https://esm.sh/bcryptjs@2.4.3';

export function hashPassword(plain) {
  return hashSync(plain, 10);
}

export function verifyPassword(plain, hashed) {
  if (!hashed) return false;
  try {
    return compareSync(plain, hashed);
  } catch (err) {
    console.error('Error comparando contraseña', err);
    return false;
  }
}
