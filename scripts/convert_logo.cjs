const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const inputPath = 'C:\\HSC\\LOGO_HSC_PADRAO.png';
const outputPath = path.resolve(__dirname, '..', 'public', 'LOGO_HSC_WHITE.png');

async function convertToWhite() {
    try {
        if (!fs.existsSync(inputPath)) {
            console.error('Erro: Arquivo original não encontrado em ' + inputPath);
            return;
        }

        await sharp(inputPath)
            .modulate({
                brightness: 2, // Aumenta brilho
            })
            .linear(0, 255) // Força todos os canais para o máximo (branco) mantendo o alpha
            .toFile(outputPath);

        console.log('Sucesso! Logo convertida para branco e salva em: ' + outputPath);
    } catch (err) {
        console.error('Erro durante a conversão:', err);
    }
}

convertToWhite();
