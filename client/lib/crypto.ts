import CryptoJS from 'crypto-js';

const SECRET_SALT = 'wechat_super_secret_salt_2026';

export const encryptMessage = (text: string, roomId: string) => {
  if (!text) return text;
  // Use roomId to ensure only people in this room can decrypt
  const secretKey = `${roomId}_${SECRET_SALT}`;
  const encrypted = CryptoJS.AES.encrypt(text, secretKey).toString();
  return `E2EE::${encrypted}`;
};

export const decryptMessage = (encryptedText: string, roomId: string) => {
  if (!encryptedText || !encryptedText.startsWith('E2EE::')) {
    return encryptedText; // Backwards compatibility for unencrypted messages
  }
  
  try {
    const secretKey = `${roomId}_${SECRET_SALT}`;
    const ciphertext = encryptedText.replace('E2EE::', '');
    const bytes = CryptoJS.AES.decrypt(ciphertext, secretKey);
    const originalText = bytes.toString(CryptoJS.enc.Utf8);
    return originalText || encryptedText; // Fallback to raw text if decryption fails
  } catch (error) {
    console.error("Decryption failed", error);
    return "Encrypted Message";
  }
};
