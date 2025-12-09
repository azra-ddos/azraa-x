import CryptoJS from 'crypto-js';

export const setupEncryptionEngine = {
    encrypt(text, key, algorithm = 'AES') {
        switch (algorithm.toUpperCase()) {
            case 'AES':
                return CryptoJS.AES.encrypt(text, key).toString();
            case 'DES':
                return CryptoJS.DES.encrypt(text, key).toString();
            case 'RABBIT':
                return CryptoJS.Rabbit.encrypt(text, key).toString();
            default:
                return CryptoJS.AES.encrypt(text, key).toString();
        }
    },
    
    decrypt(ciphertext, key, algorithm = 'AES') {
        try {
            let bytes;
            switch (algorithm.toUpperCase()) {
                case 'AES':
                    bytes = CryptoJS.AES.decrypt(ciphertext, key);
                    break;
                case 'DES':
                    bytes = CryptoJS.DES.decrypt(ciphertext, key);
                    break;
                case 'RABBIT':
                    bytes = CryptoJS.Rabbit.decrypt(ciphertext, key);
                    break;
                default:
                    bytes = CryptoJS.AES.decrypt(ciphertext, key);
            }
            return bytes.toString(CryptoJS.enc.Utf8);
        } catch (err) {
            return '[DECRYPTION ERROR]';
        }
    }
};