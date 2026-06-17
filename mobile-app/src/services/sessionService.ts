let currentEmail = 'user@glove.com';

export const sessionService = {
  setEmail(email: string) {
    currentEmail = email.trim().toLowerCase();
  },
  getEmail(): string {
    return currentEmail;
  },
};
