class FloorPlan3D {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) return;

        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.devices = [];
        this.labels = [];
        this.animationId = null;
        this.isAutoRotating = false;
        this.defaultCameraPosition = null;
        this.defaultTarget = null;

        this.init();
        this.createFloorPlan();
        this.bindControls();
        this.animate();
    }

    init() {
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0a0e17);

        this.camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
        this.updateCameraPosition();

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.container.appendChild(this.renderer.domElement);

        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.minDistance = 10;
        this.controls.maxDistance = 100;
        this.controls.maxPolarAngle = Math.PI / 2 - 0.1;
        this.controls.target.set(0, 0, 0);
        this.controls.autoRotateSpeed = 1.0;

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(10, 20, 10);
        this.scene.add(directionalLight);

        const pointLight = new THREE.PointLight(0x00d4ff, 0.3, 50);
        pointLight.position.set(0, 10, 0);
        this.scene.add(pointLight);

        window.addEventListener('resize', () => this.handleResize());
    }

    updateCameraPosition() {
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;

        const floorWidth = 16;
        const floorHeight = 10;
        const diagonal = Math.sqrt(floorWidth * floorWidth + floorHeight * floorHeight);

        const distance = diagonal * 0.75;

        this.camera.position.set(0, distance * 0.9, distance);
        this.camera.lookAt(0, 0, 0);

        if (this.controls) {
            this.controls.target.set(0, 0, 0);
            this.controls.minDistance = diagonal * 0.2;
            this.controls.maxDistance = diagonal * 1.5;
        }

        this.defaultCameraPosition = this.camera.position.clone();
        this.defaultTarget = new THREE.Vector3(0, 0, 0);
    }

    bindControls() {
        const btnReset = document.getElementById('btnReset');
        const btnAutoRotate = document.getElementById('btnAutoRotate');
        const btnZoomIn = document.getElementById('btnZoomIn');
        const btnZoomOut = document.getElementById('btnZoomOut');

        if (btnReset) {
            btnReset.addEventListener('click', () => this.resetView());
        }

        if (btnAutoRotate) {
            btnAutoRotate.addEventListener('click', () => this.toggleAutoRotate(btnAutoRotate));
        }

        if (btnZoomIn) {
            btnZoomIn.addEventListener('click', () => this.zoomIn());
        }

        if (btnZoomOut) {
            btnZoomOut.addEventListener('click', () => this.zoomOut());
        }
    }

    resetView() {
        this.controls.autoRotate = false;
        this.isAutoRotating = false;

        const wasDamping = this.controls.enableDamping;
        this.controls.enableDamping = false;
        this.controls.update();
        this.controls.enableDamping = wasDamping;

        const floorWidth = 16;
        const floorHeight = 10;
        const diagonal = Math.sqrt(floorWidth * floorWidth + floorHeight * floorHeight);
        const distance = diagonal * 0.75;

        this.controls.object.position.set(0, distance * 0.9, distance);
        this.controls.target.set(0, 0, 0);
        this.controls.object.updateProjectionMatrix();

        this.controls.minDistance = diagonal * 0.2;
        this.controls.maxDistance = diagonal * 1.5;

        this.defaultCameraPosition = this.controls.object.position.clone();
        this.defaultTarget = new THREE.Vector3(0, 0, 0);

        this.controls.enableDamping = false;
        this.controls.update();
        this.controls.enableDamping = wasDamping;

        const btnAutoRotate = document.getElementById('btnAutoRotate');
        if (btnAutoRotate) {
            btnAutoRotate.classList.remove('active');
        }
    }

    toggleAutoRotate(btn) {
        this.isAutoRotating = !this.isAutoRotating;
        this.controls.autoRotate = this.isAutoRotating;
        if (btn) {
            btn.classList.toggle('active', this.isAutoRotating);
        }
    }

    zoomIn() {
        const direction = new THREE.Vector3();
        direction.subVectors(this.camera.position, this.controls.target).normalize();
        const newPosition = this.camera.position.clone().sub(direction.multiplyScalar(2));
        if (newPosition.distanceTo(this.controls.target) <= this.controls.maxDistance) {
            this.camera.position.copy(newPosition);
            this.controls.update();
        }
    }

    zoomOut() {
        const direction = new THREE.Vector3();
        direction.subVectors(this.camera.position, this.controls.target).normalize();
        const newPosition = this.camera.position.clone().add(direction.multiplyScalar(2));
        if (newPosition.distanceTo(this.controls.target) >= this.controls.minDistance) {
            this.camera.position.copy(newPosition);
            this.controls.update();
        }
    }

    createFloorPlan() {
        this.createFloor();
        this.createWalls();
        this.createFurniture();
        this.createDevices();
    }

    createFloor() {
        const floorGeometry = new THREE.PlaneGeometry(16, 10);
        const floorMaterial = new THREE.MeshStandardMaterial({
            color: 0x1a1a2e,
            roughness: 0.8,
            metalness: 0.2
        });
        const floor = new THREE.Mesh(floorGeometry, floorMaterial);
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = 0;
        this.scene.add(floor);

        const gridHelper = new THREE.GridHelper(16, 16, 0x00d4ff, 0x00d4ff);
        gridHelper.position.y = 0.01;
        gridHelper.material.opacity = 0.1;
        gridHelper.material.transparent = true;
        this.scene.add(gridHelper);
    }

    createWalls() {
        const wallHeight = 2.0;
        const wallThickness = 0.2;
        const wallMaterial = new THREE.MeshStandardMaterial({
            color: 0x2d3a4a,
            roughness: 0.7,
            metalness: 0.1,
            transparent: true,
            opacity: 0.3
        });

        const outerWalls = [
            { pos: [0, wallHeight / 2, -5], size: [16, wallHeight, wallThickness] },
            { pos: [0, wallHeight / 2, 5], size: [16, wallHeight, wallThickness] },
            { pos: [-8, wallHeight / 2, 0], size: [wallThickness, wallHeight, 10] },
            { pos: [8, wallHeight / 2, 0], size: [wallThickness, wallHeight, 10] }
        ];

        outerWalls.forEach(wall => {
            const geometry = new THREE.BoxGeometry(...wall.size);
            const mesh = new THREE.Mesh(geometry, wallMaterial);
            mesh.position.set(...wall.pos);
            this.scene.add(mesh);
        });

        const innerWalls = [
            // 左半部分 - 上下分隔卧室1和卧室2
            { pos: [-5.5, wallHeight / 2, 0], size: [5, wallHeight, wallThickness] },
            // 左半部分 - 与中间客厅的分隔
            { pos: [-3, wallHeight / 2, 0], size: [wallThickness, wallHeight, 10] },
            // 右上卧室3 - 与客厅的分隔
            { pos: [3, wallHeight / 2, -2.5], size: [wallThickness, wallHeight, 5] },
            // 右上卧室3 - 与右下卧室的分隔
            { pos: [5.5, wallHeight / 2, 0], size: [5, wallHeight, wallThickness] },
            // 右下卧室4 - 与客厅的分隔
            { pos: [3, wallHeight / 2, 2.5], size: [wallThickness, wallHeight, 5] }
        ];

        innerWalls.forEach(wall => {
            const geometry = new THREE.BoxGeometry(...wall.size);
            const mesh = new THREE.Mesh(geometry, wallMaterial);
            mesh.position.set(...wall.pos);
            this.scene.add(mesh);

            const edgeGeometry = new THREE.EdgesGeometry(geometry);
            const edgeMaterial = new THREE.LineBasicMaterial({ color: 0x00d4ff, transparent: true, opacity: 0.3 });
            const edges = new THREE.LineSegments(edgeGeometry, edgeMaterial);
            mesh.add(edges);
        });
    }

    createFurniture() {
        // 客厅 - 沙发
        this.createSofa(0, 0, 2.5, 0x8B4513);
        // 客厅 - 茶几
        this.createCoffeeTable(0, 0, 1, 0x654321);
        // 客厅 - 电视柜
        this.createTVStand(-2, 0, -2, 0x654321);

        // 卧室1 - 床
        this.createBed(-5.5, 0, -2.5, 0x4169E1);
        // 卧室1 - 床头柜
        this.createNightstand(-7, 0, -3.5, 0x654321);

        // 卧室2 - 床
        this.createBed(-5.5, 0, 2.5, 0x4169E1);
        // 卧室2 - 床头柜
        this.createNightstand(-7, 0, 3.5, 0x654321);

        // 卧室3 - 床
        this.createBed(5.5, 0, -2.5, 0x4169E1);
        // 卧室3 - 床头柜
        this.createNightstand(7, 0, -3.5, 0x654321);

        // 卧室4 - 书桌
        this.createDesk(5.5, 0, 2.5, 0x654321);
        // 卧室4 - 椅子
        this.createChair(5.5, 0, 1.5, 0x8B4513);
    }

    createSofa(x, y, z, color) {
        const group = new THREE.Group();
        group.position.set(x, y, z);

        // 沙发底座
        const baseGeometry = new THREE.BoxGeometry(3, 0.5, 1.2);
        const baseMaterial = new THREE.MeshStandardMaterial({ color: color, roughness: 0.8 });
        const base = new THREE.Mesh(baseGeometry, baseMaterial);
        base.position.y = 0.25;
        group.add(base);

        // 沙发靠背
        const backGeometry = new THREE.BoxGeometry(3, 1, 0.3);
        const back = new THREE.Mesh(backGeometry, baseMaterial);
        back.position.set(0, 0.75, -0.45);
        group.add(back);

        // 沙发扶手
        const armGeometry = new THREE.BoxGeometry(0.3, 0.8, 1.2);
        const leftArm = new THREE.Mesh(armGeometry, baseMaterial);
        leftArm.position.set(-1.35, 0.65, 0);
        group.add(leftArm);

        const rightArm = new THREE.Mesh(armGeometry, baseMaterial);
        rightArm.position.set(1.35, 0.65, 0);
        group.add(rightArm);

        this.scene.add(group);
    }

    createCoffeeTable(x, y, z, color) {
        const group = new THREE.Group();
        group.position.set(x, y, z);

        // 桌面
        const topGeometry = new THREE.BoxGeometry(1.5, 0.1, 0.8);
        const topMaterial = new THREE.MeshStandardMaterial({ color: color, roughness: 0.6 });
        const top = new THREE.Mesh(topGeometry, topMaterial);
        top.position.y = 0.5;
        group.add(top);

        // 桌腿
        const legGeometry = new THREE.BoxGeometry(0.1, 0.5, 0.1);
        const legMaterial = new THREE.MeshStandardMaterial({ color: 0x333333 });
        
        const positions = [
            [-0.6, 0.25, -0.3],
            [0.6, 0.25, -0.3],
            [-0.6, 0.25, 0.3],
            [0.6, 0.25, 0.3]
        ];

        positions.forEach(pos => {
            const leg = new THREE.Mesh(legGeometry, legMaterial);
            leg.position.set(...pos);
            group.add(leg);
        });

        this.scene.add(group);
    }

    createTVStand(x, y, z, color) {
        const group = new THREE.Group();
        group.position.set(x, y, z);

        // 柜体
        const bodyGeometry = new THREE.BoxGeometry(2, 0.8, 0.5);
        const bodyMaterial = new THREE.MeshStandardMaterial({ color: color, roughness: 0.6 });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.position.y = 0.4;
        group.add(body);

        // 电视屏幕
        const screenGeometry = new THREE.BoxGeometry(1.8, 1.2, 0.1);
        const screenMaterial = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.2 });
        const screen = new THREE.Mesh(screenGeometry, screenMaterial);
        screen.position.set(0, 1.4, 0);
        group.add(screen);

        this.scene.add(group);
    }

    createBed(x, y, z, color) {
        const group = new THREE.Group();
        group.position.set(x, y, z);

        // 床架
        const frameGeometry = new THREE.BoxGeometry(2, 0.4, 2.5);
        const frameMaterial = new THREE.MeshStandardMaterial({ color: 0x654321, roughness: 0.8 });
        const frame = new THREE.Mesh(frameGeometry, frameMaterial);
        frame.position.y = 0.2;
        group.add(frame);

        // 床垫
        const mattressGeometry = new THREE.BoxGeometry(1.8, 0.3, 2.3);
        const mattressMaterial = new THREE.MeshStandardMaterial({ color: color, roughness: 0.9 });
        const mattress = new THREE.Mesh(mattressGeometry, mattressMaterial);
        mattress.position.y = 0.55;
        group.add(mattress);

        // 枕头
        const pillowGeometry = new THREE.BoxGeometry(1.2, 0.15, 0.4);
        const pillowMaterial = new THREE.MeshStandardMaterial({ color: 0xFFFFFF, roughness: 0.9 });
        const pillow = new THREE.Mesh(pillowGeometry, pillowMaterial);
        pillow.position.set(0, 0.75, -0.8);
        group.add(pillow);

        // 床头板
        const headboardGeometry = new THREE.BoxGeometry(2, 1.2, 0.1);
        const headboard = new THREE.Mesh(headboardGeometry, frameMaterial);
        headboard.position.set(0, 0.8, -1.25);
        group.add(headboard);

        this.scene.add(group);
    }

    createNightstand(x, y, z, color) {
        const group = new THREE.Group();
        group.position.set(x, y, z);

        // 柜体
        const bodyGeometry = new THREE.BoxGeometry(0.6, 0.6, 0.5);
        const bodyMaterial = new THREE.MeshStandardMaterial({ color: color, roughness: 0.7 });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.position.y = 0.3;
        group.add(body);

        // 抽屉
        const drawerGeometry = new THREE.BoxGeometry(0.5, 0.2, 0.05);
        const drawerMaterial = new THREE.MeshStandardMaterial({ color: 0x8B7355 });
        const drawer = new THREE.Mesh(drawerGeometry, drawerMaterial);
        drawer.position.set(0, 0.4, 0.25);
        group.add(drawer);

        // 台灯
        const lampBaseGeometry = new THREE.CylinderGeometry(0.1, 0.15, 0.1, 16);
        const lampBaseMaterial = new THREE.MeshStandardMaterial({ color: 0x333333 });
        const lampBase = new THREE.Mesh(lampBaseGeometry, lampBaseMaterial);
        lampBase.position.y = 0.65;
        group.add(lampBase);

        const lampPoleGeometry = new THREE.CylinderGeometry(0.02, 0.02, 0.4, 8);
        const lampPole = new THREE.Mesh(lampPoleGeometry, lampBaseMaterial);
        lampPole.position.y = 0.9;
        group.add(lampPole);

        const lampShadeGeometry = new THREE.ConeGeometry(0.2, 0.25, 16, 1, true);
        const lampShadeMaterial = new THREE.MeshStandardMaterial({ color: 0xFFF8DC, transparent: true, opacity: 0.8 });
        const lampShade = new THREE.Mesh(lampShadeGeometry, lampShadeMaterial);
        lampShade.position.y = 1.1;
        group.add(lampShade);

        this.scene.add(group);
    }

    createDesk(x, y, z, color) {
        const group = new THREE.Group();
        group.position.set(x, y, z);

        // 桌面
        const topGeometry = new THREE.BoxGeometry(1.8, 0.1, 0.9);
        const topMaterial = new THREE.MeshStandardMaterial({ color: color, roughness: 0.6 });
        const top = new THREE.Mesh(topGeometry, topMaterial);
        top.position.y = 0.75;
        group.add(top);

        // 桌腿
        const legGeometry = new THREE.BoxGeometry(0.08, 0.75, 0.08);
        const legMaterial = new THREE.MeshStandardMaterial({ color: 0x333333 });
        
        const positions = [
            [-0.8, 0.375, -0.35],
            [0.8, 0.375, -0.35],
            [-0.8, 0.375, 0.35],
            [0.8, 0.375, 0.35]
        ];

        positions.forEach(pos => {
            const leg = new THREE.Mesh(legGeometry, legMaterial);
            leg.position.set(...pos);
            group.add(leg);
        });

        // 电脑显示器
        const monitorGeometry = new THREE.BoxGeometry(0.6, 0.4, 0.05);
        const monitorMaterial = new THREE.MeshStandardMaterial({ color: 0x111111 });
        const monitor = new THREE.Mesh(monitorGeometry, monitorMaterial);
        monitor.position.set(0, 1, -0.2);
        group.add(monitor);

        // 显示器支架
        const standGeometry = new THREE.BoxGeometry(0.1, 0.2, 0.1);
        const stand = new THREE.Mesh(standGeometry, legMaterial);
        stand.position.set(0, 0.9, -0.2);
        group.add(stand);

        this.scene.add(group);
    }

    createChair(x, y, z, color) {
        const group = new THREE.Group();
        group.position.set(x, y, z);

        // 座椅
        const seatGeometry = new THREE.BoxGeometry(0.5, 0.1, 0.5);
        const seatMaterial = new THREE.MeshStandardMaterial({ color: color, roughness: 0.8 });
        const seat = new THREE.Mesh(seatGeometry, seatMaterial);
        seat.position.y = 0.5;
        group.add(seat);

        // 靠背
        const backGeometry = new THREE.BoxGeometry(0.5, 0.6, 0.1);
        const back = new THREE.Mesh(backGeometry, seatMaterial);
        back.position.set(0, 0.8, -0.2);
        group.add(back);

        // 椅腿
        const legGeometry = new THREE.CylinderGeometry(0.03, 0.03, 0.5, 8);
        const legMaterial = new THREE.MeshStandardMaterial({ color: 0x333333 });
        
        const positions = [
            [-0.2, 0.25, -0.2],
            [0.2, 0.25, -0.2],
            [-0.2, 0.25, 0.2],
            [0.2, 0.25, 0.2]
        ];

        positions.forEach(pos => {
            const leg = new THREE.Mesh(legGeometry, legMaterial);
            leg.position.set(...pos);
            group.add(leg);
        });

        this.scene.add(group);
    }

    createDevices() {
        const deviceData = [
            { pos: [-5.5, 0.5, -2.5], color: 0x7b2cbf, name: '路由1', signal: 88 },
            { pos: [-5.5, 0.5, 2.5], color: 0x7b2cbf, name: '路由2', signal: 82 },
            { pos: [0, 0.5, 0], color: 0xff6b6b, name: '电视', signal: 70 },
            { pos: [5.5, 0.5, 2.5], color: 0x00d4ff, name: '光猫', signal: 95 }
        ];

        deviceData.forEach(device => {
            this.add3DDevice(device.pos, device.color, device.name, device.signal);
        });
    }

    add3DDevice(position, color, name, signal) {
        const group = new THREE.Group();
        group.position.set(...position);

        const sphereGeometry = new THREE.SphereGeometry(0.4, 32, 32);
        const sphereMaterial = new THREE.MeshStandardMaterial({
            color: color,
            emissive: color,
            emissiveIntensity: 0.5,
            roughness: 0.3,
            metalness: 0.7
        });
        const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
        group.add(sphere);

        const ringGeometry = new THREE.RingGeometry(0.6, 0.8, 32);
        const ringMaterial = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.4,
            side: THREE.DoubleSide
        });
        const ring = new THREE.Mesh(ringGeometry, ringMaterial);
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = -0.3;
        group.add(ring);

        const signalStrength = Math.floor(signal / 25);
        for (let i = 0; i < 4; i++) {
            const arcRadius = 0.6 + i * 0.25;
            const arcGeometry = new THREE.TorusGeometry(arcRadius, 0.03, 8, 16, Math.PI * 0.5);
            const arcMaterial = new THREE.MeshBasicMaterial({
                color: i < signalStrength ? color : 0x333333,
                transparent: true,
                opacity: i < signalStrength ? 0.8 : 0.2
            });
            const arc = new THREE.Mesh(arcGeometry, arcMaterial);
            arc.rotation.x = -Math.PI / 2;
            arc.rotation.z = -Math.PI * 0.25;
            arc.position.y = -0.3;
            group.add(arc);
        }

        const labelCanvas = document.createElement('canvas');
        const ctx = labelCanvas.getContext('2d');
        labelCanvas.width = 256;
        labelCanvas.height = 128;

        ctx.fillStyle = 'rgba(13, 20, 36, 0.9)';
        this.roundRect(ctx, 0, 0, 256, 80, 10);
        ctx.fill();

        ctx.strokeStyle = '#00d4ff';
        ctx.lineWidth = 3;
        this.roundRect(ctx, 0, 0, 256, 80, 10);
        ctx.stroke();

        ctx.font = 'bold 36px Arial';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.fillText(name, 128, 35);

        ctx.font = 'bold 28px Arial';
        ctx.fillStyle = color.toString(16).padStart(6, '0');
        ctx.fillText(`信号: ${signal}%`, 128, 65);

        const labelTexture = new THREE.CanvasTexture(labelCanvas);
        const labelMaterial = new THREE.SpriteMaterial({ map: labelTexture, transparent: true });
        const label = new THREE.Sprite(labelMaterial);
        label.position.y = 1.5;
        label.scale.set(2, 1, 1);
        group.add(label);

        this.devices.push({
            group: group,
            sphere: sphere,
            ring: ring,
            signal: signal,
            baseColor: color
        });

        this.scene.add(group);
    }

    roundRect(ctx, x, y, width, height, radius) {
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
    }

    updateDeviceSignal(deviceName, signal) {
        const device = this.devices.find(d => {
            const label = d.group.children.find(c => c.type === 'Sprite');
            return label && label.material.map.image;
        });
    }

    animate() {
        this.animationId = requestAnimationFrame(() => this.animate());

        this.controls.update();

        const time = Date.now() * 0.001;

        this.devices.forEach((device, index) => {
            device.sphere.position.y = Math.sin(time + index) * 0.1;
            device.ring.scale.set(1 + Math.sin(time * 2 + index) * 0.1, 1 + Math.sin(time * 2 + index) * 0.1, 1);
            device.ring.material.opacity = 0.3 + Math.sin(time * 2 + index) * 0.1;

            device.group.children.forEach(child => {
                if (child.type === 'Mesh' && child.geometry.type === 'TorusGeometry') {
                    child.rotation.z = time + index;
                }
            });
        });

        this.renderer.render(this.scene, this.camera);
    }

    handleResize() {
        if (!this.container || !this.camera || !this.renderer) return;

        const width = this.container.clientWidth;
        const height = this.container.clientHeight;

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
        this.updateCameraPosition();
    }

    resize() {
        this.handleResize();
    }
}