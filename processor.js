import sharp from 'sharp';
import QRCode from 'qrcode';

export const setupImageProcessor = {
    async generateQR(data, size = 300) {
        try {
            const qrDataUrl = await QRCode.toBuffer(data, { width: size, margin: 2 });
            const qrWithLogo = await sharp(qrDataUrl)
                .composite([{
                    input: Buffer.from(`
                        <svg width="${size/5}" height="${size/5}">
                            <circle cx="${size/10}" cy="${size/10}" r="${size/10}" fill="#667eea"/>
                        </svg>`),
                    gravity: 'center'
                }])
                .png()
                .toBuffer();
            return qrWithLogo;
        } catch (err) {
            throw new Error(`QR Generation failed: ${err.message}`);
        }
    },
    
    async createSticker(imageUrl, emojis = '🤖') {
        try {
            const response = await fetch(imageUrl);
            const buffer = await response.arrayBuffer();
            
            const sticker = await sharp(Buffer.from(buffer))
                .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
                .webp({ quality: 90 })
                .toBuffer();
            
            return sticker;
        } catch (err) {
            throw new Error(`Sticker creation failed: ${err.message}`);
        }
    }
};