/**
 * 企业级家庭网络沙盘可视化大屏 - 主应用
 * 包含3D可视化、实时数据更新、交互功能
 */

// ============================================
// 全局配置和状态
// ============================================
const CONFIG = {
    refreshRate: 2000, // 数据刷新间隔（毫秒）
    chartColors: {
        primary: '#00d4ff',
        secondary: '#7b2cbf',
        accent: '#ff006e',
        success: '#00f5d4',
        warning: '#fee440',
        danger: '#f15bb5'
    },
    mockData: true // 使用模拟数据
};

const AppState = {
    isAutoRotate: false,
    currentTimeRange: 'day',
    deviceFilter: 'all',
    charts: {},
    threeScene: null,
    uptime: 0
};

// ============================================
// 模拟数据生成器
// ============================================
const DataGenerator = {
    // 生成随机数
    random: (min, max) => Math.random() * (max - min) + min,
    
    // 生成整数随机数
    randomInt: (min, max) => Math.floor(Math.random() * (max - min + 1)) + min,
    
    // 生成光猫状态数据
    generateONTData() {
        return {
            uploadSpeed: this.randomInt(50, 150),
            downloadSpeed: this.randomInt(200, 800),
            signalStrength: this.randomInt(-75, -45),
            errorRate: (this.random(0, 0.5)).toFixed(3),
            stability: Array.from({length: 20}, () => this.randomInt(85, 100))
        };
    },
    
    // 生成路由器数据
    generateRouterData() {
        return {
            connectedDevices: this.randomInt(8, 25),
            cpuUsage: this.randomInt(20, 65),
            memoryUsage: this.randomInt(30, 70),
            temperature: this.randomInt(45, 65),
            loadLevel: this.randomInt(1, 4) // 1-4: 低、中、高、极高
        };
    },
    
    // 生成设备列表
    generateDeviceList() {
        const deviceTypes = [
            { type: 'mobile', icon: '📱', names: ['iPhone 14 Pro', 'iPhone 13', 'Samsung S23', 'Xiaomi 13', 'iPad Pro'] },
            { type: 'pc', icon: '💻', names: ['MacBook Pro', 'ThinkPad X1', 'iMac', 'Desktop PC', 'Surface Pro'] },
            { type: 'iot', icon: '📟', names: ['小米电视', '智能音箱', '扫地机器人', '智能门锁', '摄像头', '空调', '空气净化器'] }
        ];
        
        const devices = [];
        const count = this.randomInt(12, 20);
        
        for (let i = 0; i < count; i++) {
            const typeInfo = deviceTypes[this.randomInt(0, deviceTypes.length - 1)];
            const name = typeInfo.names[this.randomInt(0, typeInfo.names.length - 1)];
            const isOnline = Math.random() > 0.1;
            
            devices.push({
                id: `device_${i}`,
                name: name,
                type: typeInfo.type,
                icon: typeInfo.icon,
                mac: `AA:BB:CC:${this.randomInt(10, 99)}:${this.randomInt(10, 99)}:${this.randomInt(10, 99)}`,
                ip: `192.168.1.${this.randomInt(10, 200)}`,
                traffic: isOnline ? `${this.randomInt(1, 50)} MB/s` : '0 MB/s',
                duration: isOnline ? `${this.randomInt(1, 24)}h ${this.randomInt(0, 59)}m` : '--',
                status: isOnline ? 'online' : 'offline',
                signal: isOnline ? this.randomInt(60, 100) : 0
            });
        }
        
        return devices;
    },
    
    // 生成历史趋势数据
    generateTrendData(range) {
        const points = range === 'day' ? 24 : range === 'week' ? 7 : 30;
        const labels = [];
        const bandwidth = [];
        const latency = [];
        const packetLoss = [];
        
        for (let i = 0; i < points; i++) {
            if (range === 'day') {
                labels.push(`${i}:00`);
            } else if (range === 'week') {
                const days = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
                labels.push(days[i]);
            } else {
                labels.push(`${i + 1}日`);
            }
            
            bandwidth.push(this.randomInt(300, 900));
            latency.push(this.randomInt(10, 80));
            packetLoss.push((this.random(0, 2)).toFixed(2));
        }
        
        return { labels, bandwidth, latency, packetLoss };
    }
};

// ============================================
// Three.js 3D户型图
// ============================================
class FloorPlan3D {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.rooms = [];
        this.devices = [];
        this.isAutoRotate = false;
        this.animationId = null;
        
        this.init();
    }
    
    init() {
        // 创建场景
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x050a14);
        this.scene.fog = new THREE.FogExp2(0x050a14, 0.02);
        
        // 创建相机
        const aspect = this.container.clientWidth / this.container.clientHeight;
        this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
        this.camera.position.set(0, 25, 25);
        this.camera.lookAt(0, 0, 0);
        
        // 创建渲染器
        this.renderer = new THREE.WebGLRenderer({ 
            canvas: document.getElementById('threejsCanvas'),
            antialias: true,
            alpha: true
        });
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        
        // 添加灯光
        this.setupLights();
        
        // 创建户型
        this.createFloorPlan();
        
        // 添加设备标记
        this.createDeviceMarkers();
        
        // 开始动画循环
        this.animate();
        
        // 监听窗口大小变化
        window.addEventListener('resize', () => this.onWindowResize());
    }
    
    setupLights() {
        // 环境光
        const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
        this.scene.add(ambientLight);
        
        // 主光源
        const mainLight = new THREE.DirectionalLight(0x00d4ff, 0.8);
        mainLight.position.set(10, 20, 10);
        mainLight.castShadow = true;
        mainLight.shadow.mapSize.width = 2048;
        mainLight.shadow.mapSize.height = 2048;
        this.scene.add(mainLight);
        
        // 辅助光源
        const auxLight = new THREE.PointLight(0x7b2cbf, 0.5, 50);
        auxLight.position.set(-10, 10, -10);
        this.scene.add(auxLight);
        
        // 底部发光效果
        const bottomLight = new THREE.PointLight(0x00d4ff, 0.3, 30);
        bottomLight.position.set(0, -5, 0);
        this.scene.add(bottomLight);
    }
    
    createFloorPlan() {
        // 地板
        const floorGeometry = new THREE.PlaneGeometry(20, 16);
        const floorMaterial = new THREE.MeshStandardMaterial({
            color: 0x0a1525,
            roughness: 0.8,
            metalness: 0.2,
            transparent: true,
            opacity: 0.9
        });
        const floor = new THREE.Mesh(floorGeometry, floorMaterial);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        this.scene.add(floor);
        
        // 地板网格
        const gridHelper = new THREE.GridHelper(20, 20, 0x00d4ff, 0x1a3a5c);
        gridHelper.position.y = 0.01;
        gridHelper.material.opacity = 0.3;
        gridHelper.material.transparent = true;
        this.scene.add(gridHelper);
        
        // 房间定义
        const roomConfigs = [
            { name: 'livingRoom', x: 0, z: 0, w: 8, h: 6, color: 0x1a3a5c, label: '客厅' },
            { name: 'masterBedroom', x: 5, z: -4, w: 4, h: 4, color: 0x2a4a6c, label: '主卧' },
            { name: 'guestBedroom', x: -5, z: -4, w: 4, h: 4, color: 0x2a4a6c, label: '次卧' },
            { name: 'kitchen', x: -5, z: 4, w: 4, h: 3, color: 0x3a5a7c, label: '厨房' },
            { name: 'bathroom', x: 5, z: 4, w: 3, h: 3, color: 0x3a5a7c, label: '卫生间' },
            { name: 'balcony', x: 0, z: 6, w: 6, h: 2, color: 0x4a6a8c, label: '阳台' }
        ];
        
        roomConfigs.forEach(config => {
            this.createRoom(config);
        });
        
        // 墙壁
        this.createWalls();
    }
    
    createRoom(config) {
        const geometry = new THREE.BoxGeometry(config.w, 0.2, config.h);
        const material = new THREE.MeshStandardMaterial({
            color: config.color,
            transparent: true,
            opacity: 0.7,
            emissive: config.color,
            emissiveIntensity: 0.1
        });
        
        const room = new THREE.Mesh(geometry, material);
        room.position.set(config.x, 0.1, config.z);
        room.userData = { name: config.name, label: config.label };
        room.castShadow = true;
        room.receiveShadow = true;
        
        // 添加发光边框
        const edges = new THREE.EdgesGeometry(geometry);
        const lineMaterial = new THREE.LineBasicMaterial({ 
            color: 0x00d4ff,
            transparent: true,
            opacity: 0.5
        });
        const wireframe = new THREE.LineSegments(edges, lineMaterial);
        room.add(wireframe);
        
        this.scene.add(room);
        this.rooms.push(room);
        
        // 添加房间标签
        this.createRoomLabel(config);
    }
    
    createRoomLabel(config) {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 128;
        canvas.height = 64;
        
        context.fillStyle = 'rgba(0, 0, 0, 0.6)';
        context.fillRect(0, 0, 128, 64);
        
        context.strokeStyle = '#00d4ff';
        context.lineWidth = 2;
        context.strokeRect(2, 2, 124, 60);
        
        context.fillStyle = '#00d4ff';
        context.font = 'bold 20px Arial';
        context.textAlign = 'center';
        context.fillText(config.label, 64, 40);
        
        const texture = new THREE.CanvasTexture(canvas);
        const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
        const sprite = new THREE.Sprite(spriteMaterial);
        sprite.position.set(config.x, 2, config.z);
        sprite.scale.set(2, 1, 1);
        
        this.scene.add(sprite);
    }
    
    createWalls() {
        const wallHeight = 3;
        const wallThickness = 0.2;
        
        // 外墙
        const outerWalls = [
            { x: 0, y: wallHeight/2, z: -7.5, w: 20, h: wallHeight, d: wallThickness },
            { x: 0, y: wallHeight/2, z: 7.5, w: 20, h: wallHeight, d: wallThickness },
            { x: -9.9, y: wallHeight/2, z: 0, w: wallThickness, h: wallHeight, d: 15 },
            { x: 9.9, y: wallHeight/2, z: 0, w: wallThickness, h: wallHeight, d: 15 }
        ];
        
        outerWalls.forEach(wall => {
            const geometry = new THREE.BoxGeometry(wall.w, wall.h, wall.d);
            const material = new THREE.MeshStandardMaterial({
                color: 0x1a3a5c,
                transparent: true,
                opacity: 0.3
            });
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.set(wall.x, wall.y, wall.z);
            this.scene.add(mesh);
        });
    }
    
    createDeviceMarkers() {
        const devicePositions = [
            { x: 0, z: 0, type: 'router', color: 0x00d4ff },
            { x: -2, z: 1, type: 'tv', color: 0xff006e },
            { x: 2, z: -1, type: 'phone', color: 0x00f5d4 },
            { x: 5, z: -4, type: 'laptop', color: 0xfee440 },
            { x: -5, z: -4, type: 'tablet', color: 0x7b2cbf },
            { x: -5, z: 4, type: 'iot', color: 0xf15bb5 },
            { x: 5, z: 4, type: 'camera', color: 0xff006e }
        ];
        
        devicePositions.forEach((pos, index) => {
            this.createDeviceMarker(pos, index);
        });
    }
    
    createDeviceMarker(pos, index) {
        // 设备标记球体
        const geometry = new THREE.SphereGeometry(0.3, 16, 16);
        const material = new THREE.MeshStandardMaterial({
            color: pos.color,
            emissive: pos.color,
            emissiveIntensity: 0.5
        });
        const marker = new THREE.Mesh(geometry, material);
        marker.position.set(pos.x, 1, pos.z);
        
        // 添加发光效果
        const light = new THREE.PointLight(pos.color, 1, 5);
        light.position.set(0, 0, 0);
        marker.add(light);
        
        // 添加脉冲动画
        marker.userData = {
            originalY: 1,
            phase: index * 0.5,
            speed: 2
        };
        
        this.scene.add(marker);
        this.devices.push(marker);
        
        // 添加信号波
        this.createSignalWave(pos, pos.color);
    }
    
    createSignalWave(pos, color) {
        const waveGeometry = new THREE.RingGeometry(0.5, 0.6, 32);
        const waveMaterial = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.5,
            side: THREE.DoubleSide
        });
        
        const wave = new THREE.Mesh(waveGeometry, waveMaterial);
        wave.position.set(pos.x, 0.1, pos.z);
        wave.rotation.x = -Math.PI / 2;
        
        wave.userData = {
            scale: 1,
            opacity: 0.5,
            speed: 0.02
        };
        
        this.scene.add(wave);
        
        // 动画更新
        const animateWave = () => {
            wave.userData.scale += wave.userData.speed;
            wave.userData.opacity -= 0.01;
            
            if (wave.userData.opacity <= 0) {
                wave.userData.scale = 1;
                wave.userData.opacity = 0.5;
            }
            
            wave.scale.set(wave.userData.scale, wave.userData.scale, 1);
            wave.material.opacity = wave.userData.opacity;
            
            requestAnimationFrame(animateWave);
        };
        animateWave();
    }
    
    animate() {
        this.animationId = requestAnimationFrame(() => this.animate());
        
        const time = Date.now() * 0.001;
        
        // 设备标记浮动动画
        this.devices.forEach(device => {
            const y = device.userData.originalY + 
                     Math.sin(time * device.userData.speed + device.userData.phase) * 0.2;
            device.position.y = y;
        });
        
        // 自动旋转
        if (this.isAutoRotate) {
            this.scene.rotation.y += 0.002;
        }
        
        this.renderer.render(this.scene, this.camera);
    }
    
    onWindowResize() {
        const aspect = this.container.clientWidth / this.container.clientHeight;
        this.camera.aspect = aspect;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    }
    
    toggleAutoRotate() {
        this.isAutoRotate = !this.isAutoRotate;
        return this.isAutoRotate;
    }
    
    resetView() {
        this.camera.position.set(0, 25, 25);
        this.camera.lookAt(0, 0, 0);
        this.scene.rotation.y = 0;
        this.isAutoRotate = false;
    }
    
    showHeatmap() {
        // 切换热力图显示
        this.rooms.forEach(room => {
            const intensity = Math.random() * 0.5 + 0.2;
            room.material.emissiveIntensity = intensity;
            
            // 根据强度设置颜色
            if (intensity > 0.6) {
                room.material.emissive.setHex(0x00f5d4); // 强信号 - 青色
            } else if (intensity > 0.4) {
                room.material.emissive.setHex(0xfee440); // 中等 - 黄色
            } else {
                room.material.emissive.setHex(0xff006e); // 弱信号 - 红色
            }
        });
    }
    
    showDevices() {
        // 重置房间颜色
        this.rooms.forEach(room => {
            room.material.emissiveIntensity = 0.1;
            room.material.emissive.setHex(room.material.color.getHex());
        });
    }
    
    destroy() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        this.renderer.dispose();
    }
}

// ============================================
// 图表管理器
// ============================================
class ChartManager {
    constructor() {
        this.charts = {};
    }
    
    // 初始化稳定性图表
    initStabilityChart(containerId) {
        const chart = echarts.init(document.getElementById(containerId));
        const option = {
            grid: {
                left: 0,
                right: 0,
                top: 5,
                bottom: 5
            },
            xAxis: {
                type: 'category',
                show: false,
                data: Array.from({length: 20}, (_, i) => i)
            },
            yAxis: {
                type: 'value',
                show: false,
                min: 0,
                max: 100
            },
            series: [{
                type: 'line',
                data: Array.from({length: 20}, () => 95),
                smooth: true,
                symbol: 'none',
                lineStyle: {
                    color: '#00d4ff',
                    width: 2
                },
                areaStyle: {
                    color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                        { offset: 0, color: 'rgba(0, 212, 255, 0.3)' },
                        { offset: 1, color: 'rgba(0, 212, 255, 0)' }
                    ])
                }
            }]
        };
        chart.setOption(option);
        this.charts[containerId] = chart;
        return chart;
    }
    
    // 初始化带宽趋势图
    initBandwidthChart(containerId, data) {
        const chart = echarts.init(document.getElementById(containerId));
        const option = {
            grid: {
                left: 0,
                right: 0,
                top: 5,
                bottom: 5
            },
            xAxis: {
                type: 'category',
                show: false,
                data: data.labels
            },
            yAxis: {
                type: 'value',
                show: false
            },
            series: [{
                type: 'line',
                data: data.bandwidth,
                smooth: true,
                symbol: 'none',
                lineStyle: {
                    color: '#00d4ff',
                    width: 2
                },
                areaStyle: {
                    color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                        { offset: 0, color: 'rgba(0, 212, 255, 0.4)' },
                        { offset: 1, color: 'rgba(0, 212, 255, 0)' }
                    ])
                }
            }]
        };
        chart.setOption(option);
        this.charts[containerId] = chart;
        return chart;
    }
    
    // 初始化延迟图表
    initLatencyChart(containerId, data) {
        const chart = echarts.init(document.getElementById(containerId));
        const option = {
            grid: {
                left: 0,
                right: 0,
                top: 5,
                bottom: 5
            },
            xAxis: {
                type: 'category',
                show: false,
                data: data.labels
            },
            yAxis: {
                type: 'value',
                show: false
            },
            series: [{
                type: 'bar',
                data: data.latency,
                itemStyle: {
                    color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                        { offset: 0, color: '#fee440' },
                        { offset: 1, color: 'rgba(254, 228, 64, 0.2)' }
                    ])
                }
            }]
        };
        chart.setOption(option);
        this.charts[containerId] = chart;
        return chart;
    }
    
    // 初始化丢包率图表
    initPacketLossChart(containerId, data) {
        const chart = echarts.init(document.getElementById(containerId));
        const option = {
            grid: {
                left: 0,
                right: 0,
                top: 5,
                bottom: 5
            },
            xAxis: {
                type: 'category',
                show: false,
                data: data.labels
            },
            yAxis: {
                type: 'value',
                show: false
            },
            series: [{
                type: 'line',
                data: data.packetLoss,
                smooth: true,
                symbol: 'none',
                lineStyle: {
                    color: '#ff006e',
                    width: 2
                }
            }]
        };
        chart.setOption(option);
        this.charts[containerId] = chart;
        return chart;
    }
    
    // 更新图表
    updateChart(containerId, data) {
        const chart = this.charts[containerId];
        if (chart) {
            chart.setOption({
                series: [{
                    data: data
                }]
            });
        }
    }
    
    // 销毁所有图表
    destroyAll() {
        Object.values(this.charts).forEach(chart => {
            chart.dispose();
        });
        this.charts = {};
    }
    
    // 响应式调整
    resizeAll() {
        Object.values(this.charts).forEach(chart => {
            chart.resize();
        });
    }
}

// ============================================
// UI更新器
// ============================================
class UIUpdater {
    constructor() {
        this.chartManager = new ChartManager();
    }
    
    // 更新时间显示
    updateTime() {
        const now = new Date();
        const timeStr = now.toLocaleTimeString('zh-CN', { hour12: false });
        document.getElementById('currentTime').textContent = timeStr;
    }
    
    // 更新光猫状态
    updateONT(data) {
        // 上行速率
        document.getElementById('uploadSpeed').textContent = data.uploadSpeed;
        document.getElementById('uploadBar').style.width = `${(data.uploadSpeed / 200) * 100}%`;
        
        // 下行速率
        document.getElementById('downloadSpeed').textContent = data.downloadSpeed;
        document.getElementById('downloadBar').style.width = `${(data.downloadSpeed / 1000) * 100}%`;
        
        // 信号强度
        document.getElementById('signalStrength').textContent = data.signalStrength;
        const signalBars = document.querySelectorAll('#signalIndicator span');
        const signalLevel = Math.min(5, Math.max(1, Math.floor((data.signalStrength + 100) / 10)));
        signalBars.forEach((bar, index) => {
            bar.classList.toggle('active', index < signalLevel);
        });
        
        // 错误率
        document.getElementById('errorRate').textContent = data.errorRate;
        document.getElementById('errorIndicator').style.setProperty('--error-width', `${data.errorRate * 100}%`);
        
        // 稳定性图表
        this.chartManager.updateChart('stabilityChart', data.stability);
    }
    
    // 更新路由器状态
    updateRouter(data) {
        // 连接设备数
        const deviceCountEl = document.getElementById('connectedDevices');
        const currentCount = parseInt(deviceCountEl.textContent) || 0;
        this.animateNumber(deviceCountEl, currentCount, data.connectedDevices);
        
        // CPU使用率
        document.getElementById('cpuUsage').textContent = `${data.cpuUsage}%`;
        const cpuOffset = 283 - (283 * data.cpuUsage / 100);
        document.getElementById('cpuProgress').style.strokeDashoffset = cpuOffset;
        
        // 内存使用率
        document.getElementById('memoryUsage').textContent = `${data.memoryUsage}%`;
        const memoryOffset = 283 - (283 * data.memoryUsage / 100);
        document.getElementById('memoryProgress').style.strokeDashoffset = memoryOffset;
        
        // 温度
        document.getElementById('temperature').textContent = `${data.temperature}°C`;
        const tempPercent = (data.temperature / 80) * 100;
        const tempOffset = 283 - (283 * tempPercent / 100);
        document.getElementById('tempProgress').style.strokeDashoffset = tempOffset;
        
        // 根据温度改变颜色
        const tempCircle = document.getElementById('tempCircle');
        if (data.temperature > 60) {
            tempCircle.querySelector('.progress').style.stroke = '#ff006e';
        } else if (data.temperature > 50) {
            tempCircle.querySelector('.progress').style.stroke = '#fee440';
        } else {
            tempCircle.querySelector('.progress').style.stroke = '#00d4ff';
        }
        
        // 系统负载
        const loadBar = document.getElementById('loadBar');
        const loadValue = document.getElementById('loadValue');
        const loadPercent = (data.loadLevel / 4) * 100;
        loadBar.style.width = `${loadPercent}%`;
        
        const loadLabels = ['低', '中', '高', '极高'];
        loadValue.textContent = loadLabels[data.loadLevel - 1];
    }
    
    // 更新设备列表
    updateDeviceList(devices) {
        const listContainer = document.getElementById('deviceList');
        const filter = AppState.deviceFilter;
        
        // 过滤设备
        const filteredDevices = filter === 'all' 
            ? devices 
            : devices.filter(d => d.type === filter);
        
        // 更新统计
        document.getElementById('totalDevices').textContent = devices.length;
        document.getElementById('activeDevices').textContent = devices.filter(d => d.status === 'online').length;
        document.getElementById('highTrafficDevices').textContent = devices.filter(d => {
            const traffic = parseInt(d.traffic);
            return !isNaN(traffic) && traffic > 20;
        }).length;
        
        // 生成列表HTML
        listContainer.innerHTML = filteredDevices.map(device => `
            <div class="device-item" data-device-id="${device.id}">
                <div class="device-info">
                    <div class="device-icon">${device.icon}</div>
                    <div class="device-details">
                        <span class="device-name">${device.name}</span>
                        <span class="device-mac">${device.mac}</span>
                    </div>
                </div>
                <div class="device-ip">${device.ip}</div>
                <div class="device-traffic">${device.traffic}</div>
                <div class="device-status">
                    <span class="status-dot ${device.status}"></span>
                    <span class="status-text">${device.status === 'online' ? '在线' : '离线'}</span>
                </div>
            </div>
        `).join('');
        
        // 添加悬停事件
        listContainer.querySelectorAll('.device-item').forEach(item => {
            item.addEventListener('mouseenter', (e) => {
                const deviceId = e.currentTarget.dataset.deviceId;
                this.showDeviceTooltip(e, devices.find(d => d.id === deviceId));
            });
            item.addEventListener('mouseleave', () => {
                this.hideTooltip();
            });
        });
    }
    
    // 更新趋势图表
    updateTrendCharts(data) {
        this.chartManager.updateChart('bandwidthChart', data.bandwidth);
        this.chartManager.updateChart('latencyChart', data.latency);
        this.chartManager.updateChart('packetLossChart', data.packetLoss);
    }
    
    // 更新网络质量评分
    updateQualityScore(score) {
        document.getElementById('qualityValue').textContent = score;
        const offset = 339 - (339 * score / 100);
        document.getElementById('qualityProgress').style.strokeDashoffset = offset;
        
        // 根据分数改变颜色
        const progress = document.getElementById('qualityProgress');
        if (score >= 90) {
            progress.style.stroke = '#00f5d4';
        } else if (score >= 70) {
            progress.style.stroke = '#fee440';
        } else {
            progress.style.stroke = '#ff006e';
        }
    }
    
    // 更新公网IP
    updatePublicIP() {
        const ip = `${DataGenerator.randomInt(1, 255)}.${DataGenerator.randomInt(0, 255)}.${DataGenerator.randomInt(0, 255)}.${DataGenerator.randomInt(0, 255)}`;
        document.getElementById('publicIP').textContent = ip;
    }
    
    // 更新运行时长
    updateUptime() {
        AppState.uptime++;
        const days = Math.floor(AppState.uptime / 86400);
        const hours = Math.floor((AppState.uptime % 86400) / 3600);
        const minutes = Math.floor((AppState.uptime % 3600) / 60);
        const seconds = AppState.uptime % 60;
        
        const timeStr = `${days}天 ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        document.getElementById('uptime').textContent = timeStr;
    }
    
    // 数字动画
    animateNumber(element, from, to) {
        const duration = 500;
        const startTime = performance.now();
        
        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easeProgress = 1 - Math.pow(1 - progress, 3);
            const current = Math.round(from + (to - from) * easeProgress);
            
            element.textContent = current;
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };
        
        requestAnimationFrame(animate);
    }
    
    // 显示设备提示
    showDeviceTooltip(event, device) {
        const tooltip = document.getElementById('tooltip');
        tooltip.innerHTML = `
            <div style="font-weight: bold; margin-bottom: 5px;">${device.name}</div>
            <div>MAC: ${device.mac}</div>
            <div>IP: ${device.ip}</div>
            <div>流量: ${device.traffic}</div>
            <div>连接时长: ${device.duration}</div>
            <div>信号强度: ${device.signal}%</div>
        `;
        tooltip.style.left = `${event.clientX + 10}px`;
        tooltip.style.top = `${event.clientY + 10}px`;
        tooltip.classList.add('visible');
    }
    
    // 隐藏提示
    hideTooltip() {
        document.getElementById('tooltip').classList.remove('visible');
    }
    
    // 初始化所有图表
    initCharts() {
        // 稳定性图表
        this.chartManager.initStabilityChart('stabilityChart');
        
        // 趋势图表
        const trendData = DataGenerator.generateTrendData('day');
        this.chartManager.initBandwidthChart('bandwidthChart', trendData);
        this.chartManager.initLatencyChart('latencyChart', trendData);
        this.chartManager.initPacketLossChart('packetLossChart', trendData);
    }
}

// ============================================
// 主应用类
// ============================================
class NetworkDashboard {
    constructor() {
        this.uiUpdater = new UIUpdater();
        this.floorPlan = null;
        this.timeInterval = null;
        this.uptimeInterval = null;
        this.devices = [];
    }
    
    async init() {
        // 显示加载动画
        this.showLoading();
        
        // 模拟加载进度
        await this.simulateLoading();
        
        // 初始化3D户型图
        this.floorPlan = new FloorPlan3D('floorPlan3d');
        
        // 初始化图表
        this.uiUpdater.initCharts();

        // 初始化事件监听
        this.initEventListeners();

        // 初始数据加载
        this.devices = DataGenerator.generateDeviceList();
        this.uiUpdater.updateDeviceList(this.devices);

        // 光猫数据
        const ontData = DataGenerator.generateONTData();
        this.uiUpdater.updateONT(ontData);

        // 路由器数据
        const routerData = DataGenerator.generateRouterData();
        this.uiUpdater.updateRouter(routerData);

        // 趋势数据
        const trendData = DataGenerator.generateTrendData('day');
        this.uiUpdater.updateTrendCharts(trendData);

        // 质量评分
        this.uiUpdater.updateQualityScore(DataGenerator.randomInt(85, 99));

        this.refreshData();

        // 启动定时更新
        this.startAutoRefresh();
        
        // 隐藏加载动画
        this.hideLoading();
    }
    
    showLoading() {
        const loadingScreen = document.getElementById('loadingScreen');
        loadingScreen.classList.remove('hidden');
    }
    
    hideLoading() {
        const loadingScreen = document.getElementById('loadingScreen');
        loadingScreen.classList.add('hidden');
    }
    
    async simulateLoading() {
        const progressBar = document.getElementById('loadingProgress');
        const steps = 10;
        
        for (let i = 0; i <= steps; i++) {
            const progress = (i / steps) * 100;
            progressBar.style.width = `${progress}%`;
            await this.delay(200);
        }
    }
    
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    initEventListeners() {
        // 时间范围选择
        document.querySelectorAll('.range-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.range-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                AppState.currentTimeRange = e.target.dataset.range;
                this.updateTrendData();
            });
        });
        
        // 3D控制按钮
        document.getElementById('rotateBtn').addEventListener('click', (e) => {
            const isRotating = this.floorPlan.toggleAutoRotate();
            e.currentTarget.classList.toggle('active', isRotating);
        });
        
        document.getElementById('resetBtn').addEventListener('click', () => {
            this.floorPlan.resetView();
            document.getElementById('rotateBtn').classList.remove('active');
        });
        
        document.getElementById('heatmapBtn').addEventListener('click', (e) => {
            this.floorPlan.showHeatmap();
            document.querySelectorAll('.control-btn').forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
        });
        
        document.getElementById('deviceBtn').addEventListener('click', (e) => {
            this.floorPlan.showDevices();
            document.querySelectorAll('.control-btn').forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
        });
        
        // 窗口大小变化
        window.addEventListener('resize', () => {
            this.uiUpdater.chartManager.resizeAll();
        });
    }
    
    refreshData() {
        // 保留时间更新（底部状态栏）
        this.uiUpdater.updateTime();
        this.uiUpdater.updateUptime();
    }
    
    updateTrendData() {
        const trendData = DataGenerator.generateTrendData(AppState.currentTimeRange);
        this.uiUpdater.updateTrendCharts(trendData);
    }
    
    startAutoRefresh() {
        // 时间更新
        this.timeInterval = setInterval(() => {
            this.uiUpdater.updateTime();
        }, 1000);

        // 运行时长更新
        this.uptimeInterval = setInterval(() => {
            this.uiUpdater.updateUptime();
        }, 1000);

        // 初始化时间
        this.uiUpdater.updateTime();
        
        // 初始化公网IP
        this.uiUpdater.updatePublicIP();
    }
    
    destroy() {
        if (this.timeInterval) clearInterval(this.timeInterval);
        if (this.uptimeInterval) clearInterval(this.uptimeInterval);
        
        if (this.floorPlan) {
            this.floorPlan.destroy();
        }
        
        this.uiUpdater.chartManager.destroyAll();
    }
}

// ============================================
// 启动应用
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    const dashboard = new NetworkDashboard();
    dashboard.init();
    
    // 暴露到全局以便调试
    window.networkDashboard = dashboard;
});

// 页面卸载时清理
window.addEventListener('beforeunload', () => {
    if (window.networkDashboard) {
        window.networkDashboard.destroy();
    }
});
