// Mirrors the backend rules in app/schemas/user.py.
export const PasswordRules = [
  {
    id: 'length',
    label: 'At least 8 characters',
    test: (password: string) => password.length >= 8,
  },
  {
    id: 'letter',
    label: 'A letter',
    test: (password: string) => /\p{L}/u.test(password),
  },
  {
    id: 'number',
    label: 'A number',
    test: (password: string) => /\d/.test(password),
  },
] as const;

export function passwordIsValid(password: string) {
  return PasswordRules.every((rule) => rule.test(password));
}

export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}
