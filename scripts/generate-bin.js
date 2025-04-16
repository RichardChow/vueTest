const fs = require('fs');

// 创建一个完整的机柜数据生成器
class ServerRackGenerator {
  constructor() {
    this.vertices = [];
    this.normals = [];
    this.uvs = [];
    this.indices = [];
    this.currentIndex = 0;
  }

  // 添加一个立方体
  addCube(width, height, depth, x, y, z) {
    const w = width / 2;
    const h = height / 2;
    const d = depth / 2;

    // 顶点坐标
    const vertices = [
      // 前面
      -w + x, -h + y, -d + z,  // 左下
       w + x, -h + y, -d + z,  // 右下
       w + x,  h + y, -d + z,  // 右上
      -w + x,  h + y, -d + z,  // 左上
      // 后面
      -w + x, -h + y,  d + z,
       w + x, -h + y,  d + z,
       w + x,  h + y,  d + z,
      -w + x,  h + y,  d + z,
      // 右面
       w + x, -h + y, -d + z,
       w + x, -h + y,  d + z,
       w + x,  h + y,  d + z,
       w + x,  h + y, -d + z,
      // 左面
      -w + x, -h + y, -d + z,
      -w + x, -h + y,  d + z,
      -w + x,  h + y,  d + z,
      -w + x,  h + y, -d + z,
      // 上面
      -w + x,  h + y, -d + z,
       w + x,  h + y, -d + z,
       w + x,  h + y,  d + z,
      -w + x,  h + y,  d + z,
      // 下面
      -w + x, -h + y, -d + z,
       w + x, -h + y, -d + z,
       w + x, -h + y,  d + z,
      -w + x, -h + y,  d + z,
    ];

    // 法线
    const normals = [
      // 前面
      0, 0, -1,  0, 0, -1,  0, 0, -1,  0, 0, -1,
      // 后面
      0, 0, 1,   0, 0, 1,   0, 0, 1,   0, 0, 1,
      // 右面
      1, 0, 0,   1, 0, 0,   1, 0, 0,   1, 0, 0,
      // 左面
      -1, 0, 0,  -1, 0, 0,  -1, 0, 0,  -1, 0, 0,
      // 上面
      0, 1, 0,   0, 1, 0,   0, 1, 0,   0, 1, 0,
      // 下面
      0, -1, 0,  0, -1, 0,  0, -1, 0,  0, -1, 0,
    ];

    // UV坐标
    const uvs = [];
    for (let i = 0; i < 6; i++) { // 6个面
      uvs.push(
        0, 0,  // 左下
        1, 0,  // 右下
        1, 1,  // 右上
        0, 1   // 左上
      );
    }

    // 索引
    const indices = [];
    for (let i = 0; i < 6; i++) { // 6个面
      const base = this.currentIndex + i * 4;
      indices.push(
        base, base + 1, base + 2,
        base + 2, base + 3, base
      );
    }

    this.vertices.push(...vertices);
    this.normals.push(...normals);
    this.uvs.push(...uvs);
    this.indices.push(...indices);
    this.currentIndex += 24; // 6个面 * 4个顶点
  }

  // 生成完整的机柜
  generateRack() {
    // 添加机柜外壳
    this.addCube(0.6, 2.0, 1.0, 0, 0, 0);

    // 添加服务器单元
    const serverHeight = 0.15;
    const gap = 0.02;
    const totalServers = 10;

    for (let i = 0; i < totalServers; i++) {
      const y = -0.9 + i * (serverHeight + gap);
      this.addCube(0.55, serverHeight, 0.9, 0, y, 0);
    }

    // 创建二进制数据
    const vertexCount = this.vertices.length / 3;
    const data = new Float32Array([
      ...this.vertices,  // 顶点位置
      ...this.normals,   // 法线
      ...this.uvs        // UV坐标
    ]);

    // 创建索引数据
    const indexData = new Uint16Array(this.indices);

    // 合并数据
    const combinedBuffer = Buffer.concat([
      Buffer.from(data.buffer),
      Buffer.from(indexData.buffer)
    ]);

    return combinedBuffer;
  }
}

// 生成数据并保存文件
try {
  const generator = new ServerRackGenerator();
  const buffer = generator.generateRack();
  
  // 确保目录存在
  const dir = 'public/models/server-rack';
  if (!fs.existsSync(dir)){
    fs.mkdirSync(dir, { recursive: true });
  }

  // 写入文件
  fs.writeFileSync(`${dir}/server-rack.bin`, buffer);
  console.log('Successfully generated server-rack.bin');

  // 生成配置文件
  const config = {
    name: "Server Rack",
    version: "1.0",
    units: 42,
    dimensions: {
      width: 0.6,
      height: 2.0,
      depth: 1.0
    }
  };

  fs.writeFileSync(
    `${dir}/config.json`,
    JSON.stringify(config, null, 2)
  );
  console.log('Successfully generated config.json');

} catch (error) {
  console.error('Error generating files:', error);
} 