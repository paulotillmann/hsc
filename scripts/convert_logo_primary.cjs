const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const inputPath = 'C:\\HSC\\LOGO_HSC_PADRAO.png';
const outputPath = path.resolve(__dirname, '..', 'public', 'LOGO_HSC_PRIMARY.png');

async function convertToPrimary() {
    try {
        if (!fs.existsSync(inputPath)) return;

        // Cor primária: #5A1010 (Bordô)
        // RGB: 90, 16, 16
        await sharp(inputPath)
            .tint({ r: 90, g: 16, b: 16 })
            .toFile(outputPath);

        console.log('Sucesso! Logo convertida para primário e salva em: ' + outputPath);
    } catch (err) {
        console.error('Erro durante a conversão:', err);
    }
}

convertToPrimary();
