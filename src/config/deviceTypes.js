export const deviceTypes = {
  // 类型1的网元
  TYPE_1: {
    name: '网元类型1',
    model: {
      width: 2,
      height: 4,
      depth: 1,
      panels: [
        {
          type: 'front',
          components: [
            { 
              type: 'led', 
              position: { x: -0.8, y: 1.5, z: 0.51 }, 
              color: '0x2ecc71' 
            },
            { 
              type: 'ports', 
              count: 8,
              spacing: 0.2,
              startX: -0.8,
              position: { z: 0.51 }
            }
          ]
        }
      ],
      materials: {
        main: { color: '0x2c3e50', opacity: 0.9 },
        panel: { color: '0x95a5a6' },
        ports: { color: '0x7f8c8d' }
      }
    }
  },
  
  // 类型2的网元
  TYPE_2: {
    name: '网元类型2',
    model: {
      width: 2,
      height: 4,
      depth: 1,
      panels: [
        {
          type: 'front',
          components: [
            { 
              type: 'display', 
              width: 1.5, 
              height: 0.4,
              position: { x: 0, y: 1.5, z: 0.51 }
            },
            { 
              type: 'ports', 
              count: 12,
              spacing: 0.15,
              startX: -0.8,
              position: { y: 0, z: 0.51 }
            }
          ]
        }
      ],
      materials: {
        main: { color: '0x34495e', opacity: 0.9 }
      }
    }
  }
} 

console.log('已加载设备类型配置:', Object.keys(deviceTypes)); 