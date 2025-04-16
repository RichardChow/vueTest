const fs = require('fs');
const { createCanvas } = require('canvas');

function generateTexture(width, height, drawFunction, outputPath) {
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    drawFunction(ctx, width, height);
    
    const buffer = canvas.toBuffer('image/jpeg');
    fs.writeFileSync(outputPath, buffer);
}

// 确保目录存在
const texturesPath = 'public/models/server-rack/textures';
['metal', 'led', 'panel'].forEach(dir => {
    if (!fs.existsSync(`${texturesPath}/${dir}`)) {
        fs.mkdirSync(`${texturesPath}/${dir}`, { recursive: true });
    }
});

// 生成金属纹理
generateTexture(512, 512, (ctx, w, h) => {
    // 金属基础色
    ctx.fillStyle = '#333333';
    ctx.fillRect(0, 0, w, h);
    
    // 添加一些噪点模拟金属质感
    for (let i = 0; i < 1000; i++) {
        ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.1})`;
        ctx.fillRect(
            Math.random() * w,
            Math.random() * h,
            2,
            2
        );
    }
}, `${texturesPath}/metal/basecolor.jpg`);

// 生成LED纹理
['green', 'yellow'].forEach(color => {
    generateTexture(128, 128, (ctx, w, h) => {
        const gradient = ctx.createRadialGradient(
            w/2, h/2, 0,
            w/2, h/2, w/2
        );
        
        const baseColor = color === 'green' ? '#00ff00' : '#ffff00';
        gradient.addColorStop(0, baseColor);
        gradient.addColorStop(1, '#000000');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, w, h);
    }, `${texturesPath}/led/${color}.jpg`);
});

// 生成面板纹理
generateTexture(512, 512, (ctx, w, h) => {
    // 基础色
    ctx.fillStyle = '#222222';
    ctx.fillRect(0, 0, w, h);
    
    // 添加网格线
    ctx.strokeStyle = '#333333';
    ctx.lineWidth = 1;
    
    for (let i = 0; i < w; i += 20) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, h);
        ctx.stroke();
    }
    
    for (let i = 0; i < h; i += 20) {
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(w, i);
        ctx.stroke();
    }
}, `${texturesPath}/panel/front.jpg`);

console.log('Successfully generated textures'); 