const { customAlphabet } = require("nanoid");

export function generateUserFriendlyId(): string {
    const nanoid = customAlphabet("1234567890abcdef", 10);
    return nanoid();
}
      