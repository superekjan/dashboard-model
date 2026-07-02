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

        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.hoveredDevice = null;

        this.init();
        this.createFloorPlan();
        this.bindControls();
        this.bindDeviceInteraction();
        this.animate();
    }

    init() {
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x060a13);
        this.scene.fog = new THREE.FogExp2(0x060a13, 0.008);

        this.camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
        this.updateCameraPosition();

        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.2;
        this.container.appendChild(this.renderer.domElement);

        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.minDistance = 10;
        this.controls.maxDistance = 100;
        this.controls.maxPolarAngle = Math.PI / 2 - 0.1;
        this.controls.target.set(0, 0, 0);
        this.controls.autoRotateSpeed = 1.0;

        const ambientLight = new THREE.AmbientLight(0x8899bb, 0.4);
        this.scene.add(ambientLight);

        const hemisphereLight = new THREE.HemisphereLight(0x4488cc, 0x224466, 0.3);
        this.scene.add(hemisphereLight);

        const directionalLight = new THREE.DirectionalLight(0xffeedd, 0.7);
        directionalLight.position.set(10, 20, 10);
        this.scene.add(directionalLight);

        const fillLight = new THREE.DirectionalLight(0x4488ff, 0.2);
        fillLight.position.set(-10, 15, -10);
        this.scene.add(fillLight);

        const pointLight = new THREE.PointLight(0x00c8ff, 0.4, 50);
        pointLight.position.set(0, 10, 0);
        this.scene.add(pointLight);

        window.addEventListener('resize', () => this.handleResize());
    }

    updateCameraPosition() {
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;

        const floorWidth = 30;
        const floorHeight = 15;
        const diagonal = Math.sqrt(floorWidth * floorWidth + floorHeight * floorHeight);

        const distance = diagonal * 0.6;

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

    // 绑定设备点击与悬停交互（光猫/路由可点击查看信息）
    bindDeviceInteraction() {
        const canvas = this.renderer.domElement;
        let downPos = { x: 0, y: 0 };
        let downTime = 0;

        // 使用 pointerdown 和 pointerup 事件，更可靠且不受 OrbitControls 影响
        canvas.addEventListener('pointerdown', (e) => {
            downPos = { x: e.clientX, y: e.clientY };
            downTime = Date.now();
        });

        // 在 pointerup 上判断点击：位移小且时间短视为点击
        canvas.addEventListener('pointerup', (e) => {
            const dx = e.clientX - downPos.x;
            const dy = e.clientY - downPos.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const elapsed = Date.now() - downTime;
            // 位移超过 6px 或耗时超过 600ms 视为拖拽，忽略
            if (dist > 6 || elapsed > 600) return;

            const device = this.pickDevice(e);
            if (device) {
                this.handleDeviceClick(device);
            }
        });

        // 触摸支持：移动端点击
        let touchDownPos = { x: 0, y: 0 };
        let touchDownTime = 0;
        canvas.addEventListener('touchstart', (e) => {
            if (e.changedTouches.length === 0) return;
            const t = e.changedTouches[0];
            touchDownPos = { x: t.clientX, y: t.clientY };
            touchDownTime = Date.now();
        }, { passive: true });

        canvas.addEventListener('touchend', (e) => {
            if (e.changedTouches.length === 0) return;
            const t = e.changedTouches[0];
            const dx = t.clientX - touchDownPos.x;
            const dy = t.clientY - touchDownPos.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const elapsed = Date.now() - touchDownTime;
            if (dist > 6 || elapsed > 600) return;

            const device = this.pickDevice({ clientX: t.clientX, clientY: t.clientY });
            if (device) {
                this.handleDeviceClick(device);
            }
        }, { passive: true });

        // 悬停高亮与光标变化
        canvas.addEventListener('mousemove', (e) => {
            const device = this.pickDevice(e);
            if (device !== this.hoveredDevice) {
                this.setHoverHighlight(this.hoveredDevice, false);
                this.setHoverHighlight(device, true);
                this.hoveredDevice = device;
            }
            canvas.style.cursor = device ? 'pointer' : 'default';
        });
    }

    // 通过 raycaster 获取鼠标命中的可点击设备
    pickDevice(event) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);

        // 收集所有可点击设备的可命中对象
        const targets = [];
        this.devices.forEach(d => {
            if (d.type === 'router' || d.type === 'ont') {
                d.group.traverse(child => {
                    if (child.isMesh) targets.push(child);
                });
            }
        });

        if (targets.length === 0) return null;

        // 确保世界变换矩阵是最新的，避免 raycaster 命中失效
        this.scene.updateMatrixWorld(true);

        const intersects = this.raycaster.intersectObjects(targets, false);
        if (intersects.length === 0) return null;

        // 沿父级链查找带 clickable 标记的对象
        let obj = intersects[0].object;
        while (obj && !obj.userData.clickable) {
            obj = obj.parent;
        }
        if (!obj) return null;

        // 返回对应设备记录
        return this.devices.find(d => d.name === obj.userData.deviceName && d.type === obj.userData.deviceType) || null;
    }

    // 悬停高亮切换（缩放轻微变化）
    setHoverHighlight(device, isHover) {
        if (!device || !device.modelGroup) return;
        const scale = isHover ? 1.15 : 1.0;
        device.modelGroup.scale.set(scale, scale, scale);
    }

    // 处理设备点击：通知 app 层弹出信息窗口
    handleDeviceClick(device) {
        console.log('[FloorPlan3D] 设备被点击:', device.name, device.type);
        console.log('[FloorPlan3D] onDeviceClick 回调:', typeof this.onDeviceClick);
        if (this.onDeviceClick && typeof this.onDeviceClick === 'function') {
            console.log('[FloorPlan3D] 调用 onDeviceClick 回调');
            this.onDeviceClick(device.name, device.type);
        } else {
            console.warn('[FloorPlan3D] onDeviceClick 回调未定义或不是函数');
        }
    }

    createLabel(text, color, position, scale = { x: 2, y: 0.5 }, options = {}) {
        const canvasWidth = 256;
        const canvasHeight = options.canvasHeight || 96;
        const boxHeight = options.boxHeight || 80;

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;

        const gradient = ctx.createLinearGradient(0, 0, canvasWidth, 0);
        gradient.addColorStop(0, 'rgba(6, 10, 19, 0.92)');
        gradient.addColorStop(0.5, 'rgba(10, 16, 32, 0.95)');
        gradient.addColorStop(1, 'rgba(6, 10, 19, 0.92)');
        ctx.fillStyle = gradient;
        this.roundRect(ctx, 0, 0, canvasWidth, boxHeight, 8);
        ctx.fill();

        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.7;
        this.roundRect(ctx, 0, 0, canvasWidth, boxHeight, 8);
        ctx.stroke();
        ctx.globalAlpha = 1.0;

        const topLineGradient = ctx.createLinearGradient(0, 0, canvasWidth, 0);
        topLineGradient.addColorStop(0, 'transparent');
        topLineGradient.addColorStop(0.3, color);
        topLineGradient.addColorStop(0.7, color);
        topLineGradient.addColorStop(1, 'transparent');
        ctx.strokeStyle = topLineGradient;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(8, 1);
        ctx.lineTo(248, 1);
        ctx.stroke();

        ctx.font = 'bold 44px Arial';
        ctx.fillStyle = '#eaf4ff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = color;
        ctx.shadowBlur = 8;
        ctx.fillText(text, 128, boxHeight / 2);
        ctx.shadowBlur = 0;

        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
        const sprite = new THREE.Sprite(material);
        const aspectRatio = canvas.width / canvas.height;
        sprite.position.set(position.x, position.y, position.z);
        sprite.scale.set(scale.x, scale.x / aspectRatio, 1);
        return sprite;
    }

    createPolylineGeometry(points, steps = 50) {
        const geometry = new THREE.BufferGeometry();
        const combinedPoints = [];

        for (let i = 0; i < points.length - 1; i++) {
            const start = points[i];
            const end = points[i + 1];
            for (let j = 0; j <= steps; j++) {
                const t = j / steps;
                combinedPoints.push(
                    start.x + (end.x - start.x) * t,
                    start.y + (end.y - start.y) * t,
                    start.z + (end.z - start.z) * t
                );
            }
        }

        geometry.setAttribute('position', new THREE.Float32BufferAttribute(combinedPoints, 3));
        return geometry;
    }

    createFiberMaterial(color) {
        return new THREE.LineDashedMaterial({
            color: color,
            dashSize: 1.5,
            gapSize: 0.5,
            transparent: true,
            opacity: 0.85
        });
    }

    resetView() {
        this.controls.autoRotate = false;
        this.isAutoRotating = false;

        const wasDamping = this.controls.enableDamping;
        this.controls.enableDamping = false;
        this.controls.update();
        this.controls.enableDamping = wasDamping;

        const floorWidth = 30;
        const floorHeight = 15;
        const diagonal = Math.sqrt(floorWidth * floorWidth + floorHeight * floorHeight);
        const distance = diagonal * 0.6;

        this.controls.object.position.set(0, distance * 0.8, distance);
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
        this.createBeds();
        this.createSofaSet();
        this.createBathroom();
        this.createDevices();
        this.createRoomLabels();
        this.createInternetConnection();
        this.createAmbientParticles();
    }

    createFloor() {
        const floorGeometry = new THREE.PlaneGeometry(30, 15);
        const floorMaterial = new THREE.MeshStandardMaterial({
            color: 0x1a2035,
            roughness: 0.7,
            metalness: 0.3
        });
        const floor = new THREE.Mesh(floorGeometry, floorMaterial);
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = 0;
        this.scene.add(floor);

        const outerGlowGeometry = new THREE.PlaneGeometry(34, 19);
        const outerGlowMaterial = new THREE.MeshBasicMaterial({
            color: 0x00c8ff,
            transparent: true,
            opacity: 0.03,
            side: THREE.DoubleSide
        });
        const outerGlow = new THREE.Mesh(outerGlowGeometry, outerGlowMaterial);
        outerGlow.rotation.x = -Math.PI / 2;
        outerGlow.position.y = -0.01;
        this.scene.add(outerGlow);
    }

    createWalls() {
        const wallHeight = 2.0;
        const wallThickness = 0.2;
        const wallMaterial = new THREE.MeshStandardMaterial({
            color: 0x1e2d4a,
            roughness: 0.5,
            metalness: 0.3,
            transparent: true,
            opacity: 0.85
        });

        const outerWalls = [
            { pos: [0, wallHeight / 2, -7.5], size: [30, wallHeight, wallThickness] },
            { pos: [0, wallHeight / 2, 7.5], size: [30, wallHeight, wallThickness] },
            { pos: [-15, wallHeight / 2, 0], size: [wallThickness, wallHeight, 15] },
            { pos: [15, wallHeight / 2, 0], size: [wallThickness, wallHeight, 15] }
        ];

        outerWalls.forEach(wall => {
            const geometry = new THREE.BoxGeometry(...wall.size);
            const mesh = new THREE.Mesh(geometry, wallMaterial);
            mesh.position.set(...wall.pos);
            this.scene.add(mesh);

            const edgeGeometry = new THREE.EdgesGeometry(geometry);
            const edgeMaterial = new THREE.LineBasicMaterial({ color: 0x2a4a6a, transparent: true, opacity: 0.6 });
            const edges = new THREE.LineSegments(edgeGeometry, edgeMaterial);
            mesh.add(edges);
        });

        const innerWalls = [
            { pos: [-10, wallHeight / 2, 0], size: [10, wallHeight, wallThickness] },
            { pos: [-5, wallHeight / 2, 0], size: [wallThickness, wallHeight, 15] },
            { pos: [5, wallHeight / 2, -4.5], size: [wallThickness, wallHeight, 6] },
            { pos: [10, wallHeight / 2, -1.5], size: [10, wallHeight, wallThickness] },
            { pos: [10, wallHeight / 2, 1.5], size: [10, wallHeight, wallThickness] },
            { pos: [5, wallHeight / 2, 4.5], size: [wallThickness, wallHeight, 6] }
        ];

        innerWalls.forEach(wall => {
            const geometry = new THREE.BoxGeometry(...wall.size);
            const mesh = new THREE.Mesh(geometry, wallMaterial);
            mesh.position.set(...wall.pos);
            this.scene.add(mesh);

            const edgeGeometry = new THREE.EdgesGeometry(geometry);
            const edgeMaterial = new THREE.LineBasicMaterial({ color: 0x2a4a6a, transparent: true, opacity: 0.6 });
            const edges = new THREE.LineSegments(edgeGeometry, edgeMaterial);
            mesh.add(edges);
        });
    }

    createBeds() {
        const bedMaterial = new THREE.MeshStandardMaterial({
            color: 0x2a3a55,
            roughness: 0.7,
            metalness: 0.2
        });
        const mattressMaterial = new THREE.MeshStandardMaterial({
            color: 0x3a4a65,
            roughness: 0.8,
            metalness: 0.1
        });
        const pillowMaterial = new THREE.MeshStandardMaterial({
            color: 0x4a5a75,
            roughness: 0.8,
            metalness: 0.1
        });

        this.createBed([-12.5, 0, -3.75], bedMaterial, mattressMaterial, pillowMaterial, 'west');
        this.createBed([-12.5, 0, 3.75], bedMaterial, mattressMaterial, pillowMaterial, 'west');
        this.createBed([12.5, 0, 3.75], bedMaterial, mattressMaterial, pillowMaterial, 'east');
    }

    createBed(position, bedMaterial, mattressMaterial, pillowMaterial, orientation = 'north') {
        const bedGroup = new THREE.Group();
        bedGroup.position.set(...position);

        // 根据朝向调整床的旋转
        if (orientation === 'west') {
            bedGroup.rotation.y = Math.PI / 2;
        } else if (orientation === 'east') {
            bedGroup.rotation.y = -Math.PI / 2;
        }

        // 床架
        const bedFrameGeometry = new THREE.BoxGeometry(2, 0.3, 3);
        const bedFrame = new THREE.Mesh(bedFrameGeometry, bedMaterial);
        bedFrame.position.y = 0.15;
        bedGroup.add(bedFrame);

        // 床垫
        const mattressGeometry = new THREE.BoxGeometry(1.8, 0.2, 2.8);
        const mattress = new THREE.Mesh(mattressGeometry, mattressMaterial);
        mattress.position.y = 0.4;
        bedGroup.add(mattress);

        // 枕头
        const pillowGeometry = new THREE.BoxGeometry(1.2, 0.15, 0.5);
        const pillow = new THREE.Mesh(pillowGeometry, pillowMaterial);
        pillow.position.set(0, 0.55, -1.0);
        bedGroup.add(pillow);

        // 床头板
        const headboardGeometry = new THREE.BoxGeometry(2, 0.8, 0.1);
        const headboard = new THREE.Mesh(headboardGeometry, bedMaterial);
        headboard.position.set(0, 0.55, -1.5);
        bedGroup.add(headboard);

        this.scene.add(bedGroup);
    }

    createSofaSet() {
        const sofaMaterial = new THREE.MeshStandardMaterial({
            color: 0x1e2d4a,
            roughness: 0.7,
            metalness: 0.2
        });
        const tableMaterial = new THREE.MeshStandardMaterial({
            color: 0x2a3a55,
            roughness: 0.5,
            metalness: 0.3
        });

        const centerX = 2;
        const centerZ = -4;

        const tableGeometry = new THREE.BoxGeometry(2, 0.4, 1.2);
        const table = new THREE.Mesh(tableGeometry, tableMaterial);
        table.position.set(centerX, 0.2, centerZ);
        this.scene.add(table);

        this.createSofa([centerX, 0, centerZ - 1.5], sofaMaterial, 'north');
        this.createSofa([centerX, 0, centerZ + 1.5], sofaMaterial, 'south');
        this.createSofa([centerX - 2, 0, centerZ], sofaMaterial, 'west');
        this.createSofa([centerX + 2, 0, centerZ], sofaMaterial, 'east');
    }

    createSofa(position, material, orientation) {
        const sofaGroup = new THREE.Group();
        sofaGroup.position.set(...position);

        // 根据朝向旋转
        if (orientation === 'north') {
            sofaGroup.rotation.y = 0;
        } else if (orientation === 'south') {
            sofaGroup.rotation.y = Math.PI;
        } else if (orientation === 'west') {
            sofaGroup.rotation.y = Math.PI / 2;
        } else if (orientation === 'east') {
            sofaGroup.rotation.y = -Math.PI / 2;
        }

        // 沙发座垫
        const seatGeometry = new THREE.BoxGeometry(1.8, 0.4, 0.8);
        const seat = new THREE.Mesh(seatGeometry, material);
        seat.position.y = 0.2;
        sofaGroup.add(seat);

        // 沙发靠背
        const backGeometry = new THREE.BoxGeometry(1.8, 0.6, 0.2);
        const back = new THREE.Mesh(backGeometry, material);
        back.position.set(0, 0.5, -0.3);
        sofaGroup.add(back);

        // 沙发扶手
        const armGeometry = new THREE.BoxGeometry(0.2, 0.4, 0.8);
        const armLeft = new THREE.Mesh(armGeometry, material);
        armLeft.position.set(-0.8, 0.2, 0);
        sofaGroup.add(armLeft);

        const armRight = new THREE.Mesh(armGeometry, material);
        armRight.position.set(0.8, 0.2, 0);
        sofaGroup.add(armRight);

        this.scene.add(sofaGroup);
    }

    createBathroom() {
        const whiteMaterial = new THREE.MeshStandardMaterial({
            color: 0x3a4a65,
            roughness: 0.6,
            metalness: 0.2
        });
        const glassMaterial = new THREE.MeshStandardMaterial({
            color: 0x4a6a8a,
            roughness: 0.3,
            metalness: 0.1,
            transparent: true,
            opacity: 0.35
        });
        const chromeMaterial = new THREE.MeshStandardMaterial({
            color: 0x88aacc,
            roughness: 0.4,
            metalness: 0.5
        });

        const roomCenterX = 10;
        const roomCenterZ = -4.5;

        // 马桶 - 右侧靠墙，正面朝西
        const toiletGroup = new THREE.Group();
        toiletGroup.position.set(14, 0, -4.5);
        toiletGroup.rotation.y = -Math.PI / 2;

        const toiletBaseGeometry = new THREE.BoxGeometry(0.8, 0.4, 1);
        const toiletBase = new THREE.Mesh(toiletBaseGeometry, whiteMaterial);
        toiletBase.position.y = 0.2;
        toiletGroup.add(toiletBase);

        const toiletSeatGeometry = new THREE.BoxGeometry(0.7, 0.1, 0.8);
        const toiletSeat = new THREE.Mesh(toiletSeatGeometry, whiteMaterial);
        toiletSeat.position.y = 0.45;
        toiletGroup.add(toiletSeat);

        const toiletTankGeometry = new THREE.BoxGeometry(0.6, 0.5, 0.3);
        const toiletTank = new THREE.Mesh(toiletTankGeometry, whiteMaterial);
        toiletTank.position.set(0, 0.65, -0.4);
        toiletGroup.add(toiletTank);
        this.scene.add(toiletGroup);

        // 浴缸 - 靠上墙
        const bathtubGroup = new THREE.Group();
        bathtubGroup.position.set(roomCenterX, 0, -6.5);

        const bathtubGeometry = new THREE.BoxGeometry(3, 0.8, 1.5);
        const bathtub = new THREE.Mesh(bathtubGeometry, whiteMaterial);
        bathtub.position.y = 0.4;
        bathtubGroup.add(bathtub);

        const bathtubInnerGeometry = new THREE.BoxGeometry(2.8, 0.6, 1.3);
        const bathtubInner = new THREE.Mesh(bathtubInnerGeometry, whiteMaterial);
        bathtubInner.position.y = 0.2;
        bathtubGroup.add(bathtubInner);
        this.scene.add(bathtubGroup);

        // 洗手台 - 靠左墙
        const sinkGroup = new THREE.Group();
        sinkGroup.position.set(6, 0, -6);

        const sinkBaseGeometry = new THREE.BoxGeometry(0.5, 0.8, 1.2);
        const sinkBase = new THREE.Mesh(sinkBaseGeometry, whiteMaterial);
        sinkBase.position.y = 0.4;
        sinkGroup.add(sinkBase);

        const sinkTopGeometry = new THREE.BoxGeometry(0.6, 0.1, 1.3);
        const sinkTop = new THREE.Mesh(sinkTopGeometry, whiteMaterial);
        sinkTop.position.y = 0.85;
        sinkGroup.add(sinkTop);

        const basinGeometry = new THREE.CylinderGeometry(0.25, 0.3, 0.15, 16);
        const basin = new THREE.Mesh(basinGeometry, whiteMaterial);
        basin.position.set(0, 0.85, 0);
        sinkGroup.add(basin);

        const faucetGeometry = new THREE.CylinderGeometry(0.03, 0.03, 0.3, 8);
        const faucet = new THREE.Mesh(faucetGeometry, chromeMaterial);
        faucet.position.set(0, 1.0, -0.3);
        sinkGroup.add(faucet);
        this.scene.add(sinkGroup);

        // 淋浴房 - 左下角
        const showerGroup = new THREE.Group();
        showerGroup.position.set(6.5, 0, -2.5);

        const showerFloorGeometry = new THREE.CylinderGeometry(1, 1, 0.05, 16);
        const showerFloor = new THREE.Mesh(showerFloorGeometry, whiteMaterial);
        showerFloor.position.y = 0.025;
        showerGroup.add(showerFloor);

        const showerGlassGeometry = new THREE.CylinderGeometry(1, 1, 2, 16, 1, true, 0, Math.PI);
        const showerGlass = new THREE.Mesh(showerGlassGeometry, glassMaterial);
        showerGlass.position.y = 1;
        showerGroup.add(showerGlass);

        const showerPoleGeometry = new THREE.CylinderGeometry(0.03, 0.03, 2, 8);
        const showerPole = new THREE.Mesh(showerPoleGeometry, chromeMaterial);
        showerPole.position.set(0, 1, 0);
        showerGroup.add(showerPole);

        const showerHeadGeometry = new THREE.CylinderGeometry(0.2, 0.1, 0.1, 16);
        const showerHead = new THREE.Mesh(showerHeadGeometry, chromeMaterial);
        showerHead.position.set(0, 1.95, 0);
        showerGroup.add(showerHead);
        this.scene.add(showerGroup);
    }

    createInternetConnection() {
        const globeGroup = new THREE.Group();
        const globeRadius = 1.2;

        const globeGeometry = new THREE.SphereGeometry(globeRadius, 32, 32);
        const globeMaterial = new THREE.MeshStandardMaterial({
            color: 0x1e90ff,
            roughness: 0.3,
            metalness: 0.5,
            emissive: 0x1e90ff,
            emissiveIntensity: 0.4
        });
        const globe = new THREE.Mesh(globeGeometry, globeMaterial);
        globeGroup.add(globe);

        const lineMaterial = new THREE.LineBasicMaterial({ color: 0x66bbff, transparent: true, opacity: 0.4 });

        for (let i = 0; i < 6; i++) {
            const points = [];
            const angle = (i / 6) * Math.PI;
            for (let j = 0; j <= 32; j++) {
                const lat = (j / 32) * Math.PI - Math.PI / 2;
                points.push(new THREE.Vector3(
                    globeRadius * Math.cos(lat) * Math.cos(angle),
                    globeRadius * Math.sin(lat),
                    globeRadius * Math.cos(lat) * Math.sin(angle)
                ));
            }
            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            const line = new THREE.Line(geometry, lineMaterial);
            globeGroup.add(line);
        }

        for (let i = 1; i < 6; i++) {
            const points = [];
            const lat = (i / 6) * Math.PI - Math.PI / 2;
            for (let j = 0; j <= 32; j++) {
                const lon = (j / 32) * Math.PI * 2;
                points.push(new THREE.Vector3(
                    globeRadius * Math.cos(lat) * Math.cos(lon),
                    globeRadius * Math.sin(lat),
                    globeRadius * Math.cos(lat) * Math.sin(lon)
                ));
            }
            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            const line = new THREE.Line(geometry, lineMaterial);
            globeGroup.add(line);
        }

        const glowRingGeometry = new THREE.TorusGeometry(globeRadius + 0.3, 0.05, 16, 64);
        const glowRingMaterial = new THREE.MeshBasicMaterial({
            color: 0x00c8ff,
            transparent: true,
            opacity: 0.4
        });
        const glowRing = new THREE.Mesh(glowRingGeometry, glowRingMaterial);
        glowRing.rotation.x = Math.PI / 2;
        globeGroup.add(glowRing);

        const outerGlowGeometry = new THREE.SphereGeometry(globeRadius + 0.5, 32, 32);
        const outerGlowMaterial = new THREE.MeshBasicMaterial({
            color: 0x1e90ff,
            transparent: true,
            opacity: 0.08,
            side: THREE.BackSide
        });
        const outerGlow = new THREE.Mesh(outerGlowGeometry, outerGlowMaterial);
        globeGroup.add(outerGlow);

        globeGroup.position.set(0, 1.2, -12);
        this.scene.add(globeGroup);
        this.globe = globeGroup;

        const internetLabel = this.createLabel('互联网', '#1e90ff', { x: 0, y: 3.5, z: -12 });
        this.scene.add(internetLabel);

        // 光猫位于大厅 [0, 0, 3]，作为网络中枢连接互联网与三台感知路由
        this.createPolylineFiberConnection([
            new THREE.Vector3(0, 0.15, -12),
            new THREE.Vector3(0, 0.15, 3)
        ], 0x00c8ff, 'internet');

        // 光猫 → 路由1（卧室1）
        this.createPolylineFiberConnection([
            new THREE.Vector3(0, 0.15, 3),
            new THREE.Vector3(0, 0.15, -3.75),
            new THREE.Vector3(-7, 0.15, -3.75)
        ], 0x00c8ff, 'fiber1');

        // 光猫 → 路由2（卧室2）
        this.createPolylineFiberConnection([
            new THREE.Vector3(0, 0.15, 3),
            new THREE.Vector3(-7, 0.15, 3),
            new THREE.Vector3(-7, 0.15, 3.75)
        ], 0x00c8ff, 'fiber2');

        // 光猫 → 路由3（卧室3）
        this.createPolylineFiberConnection([
            new THREE.Vector3(0, 0.15, 3),
            new THREE.Vector3(7, 0.15, 3),
            new THREE.Vector3(7, 0.15, 3.75)
        ], 0x00c8ff, 'fiber3');
    }

    createFiberConnection(startPos, endPos, color, name) {
        const linePoints = [
            startPos.clone(),
            endPos.clone()
        ];

        const lineGeometry = this.createPolylineGeometry(linePoints, 100);
        const glowMaterial = this.createFiberMaterial(color);

        const connectionLine = new THREE.Line(lineGeometry, glowMaterial);
        connectionLine.computeLineDistances();
        this.scene.add(connectionLine);

        // 计算总长度
        let totalLength = 0;
        const segments = [];
        for (let i = 0; i < linePoints.length - 1; i++) {
            const start = linePoints[i];
            const end = linePoints[i + 1];
            const length = start.distanceTo(end);
            segments.push({ start, end, length, offset: totalLength });
            totalLength += length;
        }

        // 存储以用于动画
        if (!this.fiberConnections) {
            this.fiberConnections = {};
        }
        this.fiberConnections[name] = {
            line: connectionLine,
            material: glowMaterial,
            baseDashSize: 1.5,
            segments: segments,
            totalLength: totalLength
        };
    }

    createPolylineFiberConnection(points, color, name) {
        const lineGeometry = this.createPolylineGeometry(points, 50);
        const glowMaterial = this.createFiberMaterial(color);

        const connectionLine = new THREE.Line(lineGeometry, glowMaterial);
        connectionLine.computeLineDistances();
        this.scene.add(connectionLine);

        let totalLength = 0;
        const segments = [];
        for (let i = 0; i < points.length - 1; i++) {
            const start = points[i];
            const end = points[i + 1];
            const length = start.distanceTo(end);
            segments.push({ start, end, length, offset: totalLength });
            totalLength += length;
        }

        if (!this.fiberConnections) {
            this.fiberConnections = {};
        }
        this.fiberConnections[name] = {
            line: connectionLine,
            material: glowMaterial,
            baseDashSize: 1.5,
            segments: segments,
            totalLength: totalLength
        };
    }

    createDevices() {
        const deviceData = [
            { pos: [-7, 0, -3.75], color: 0x7b2cbf, name: '路由1', signal: 88, type: 'router' },
            { pos: [-7, 0, 3.75], color: 0x7b2cbf, name: '路由2', signal: 82, type: 'router' },
            { pos: [7, 0, 3.75], color: 0x7b2cbf, name: '路由3', signal: 85, type: 'router' },
            { pos: [4.7, 0, 5], color: 0x00ff00, name: '电视', signal: 70, type: 'tv' },
            { pos: [0, 0, 3], color: 0x00d4ff, name: '光猫', signal: 95, type: 'ont' }
        ];

        deviceData.forEach(device => {
            this.add3DDevice(device.pos, device.color, device.name, device.signal, device.type);
        });
    }

    // 房间名称标注
    createRoomLabels() {
        const roomColor = '#fbbf24';
        const rooms = [
            { name: '卧室1', pos: [-10, 1.6, -3.75] },
            { name: '卧室2', pos: [-10, 1.6, 3.75] },
            { name: '大厅', pos: [0, 1.6, 0] },
            { name: '浴室', pos: [10, 1.6, -4.5] },
            { name: '卧室3', pos: [10, 1.6, 3.75] }
        ];

        rooms.forEach(room => {
            const label = this.createLabel(room.name, roomColor, { x: room.pos[0], y: room.pos[1], z: room.pos[2] }, { x: 2.4, y: 0.6 });
            this.scene.add(label);
        });
    }

    createRouterModel(color) {
        const routerGroup = new THREE.Group();

        const baseGeometry = new THREE.BoxGeometry(1.5, 0.2, 1);
        const baseMaterial = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.3,
            metalness: 0.5
        });
        const base = new THREE.Mesh(baseGeometry, baseMaterial);
        base.position.y = 0.1;
        routerGroup.add(base);

        const topGeometry = new THREE.BoxGeometry(1.4, 0.1, 0.9);
        const topMaterial = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.4,
            metalness: 0.4
        });
        const top = new THREE.Mesh(topGeometry, topMaterial);
        top.position.y = 0.25;
        routerGroup.add(top);

        const antennaMaterial = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.5,
            metalness: 0.3
        });

        const antennaPositions = [
            [-0.5, 0, -0.3],
            [0.5, 0, -0.3],
            [-0.5, 0, 0.3],
            [0.5, 0, 0.3]
        ];

        antennaPositions.forEach(pos => {
            const antennaGeometry = new THREE.CylinderGeometry(0.03, 0.03, 0.6, 8);
            const antenna = new THREE.Mesh(antennaGeometry, antennaMaterial);
            antenna.position.set(pos[0], 0.6, pos[2]);
            routerGroup.add(antenna);

            // 天线顶部小球
            const ballGeometry = new THREE.SphereGeometry(0.05, 8, 8);
            const ball = new THREE.Mesh(ballGeometry, antennaMaterial);
            ball.position.set(pos[0], 0.92, pos[2]);
            routerGroup.add(ball);
        });

        // LED指示灯
        const ledMaterial = new THREE.MeshBasicMaterial({
            color: 0x00c8ff,
            transparent: true,
            opacity: 0.8
        });
        const ledGeometry = new THREE.SphereGeometry(0.05, 8, 8);

        for (let i = 0; i < 3; i++) {
            const led = new THREE.Mesh(ledGeometry, ledMaterial);
            led.position.set(-0.3 + i * 0.3, 0.31, 0.35);
            routerGroup.add(led);
        }

        // 信号覆盖区域 - 科技感动态效果
        const signalBaseColor = 0x00c8ff;
        const signalRadii = [1.5, 2.5, 3.5];
        const signalEffects = [];

        signalRadii.forEach((radius, index) => {
            // 波纹填充层
            const fillGeometry = new THREE.CircleGeometry(radius, 64);
            const fillMaterial = new THREE.MeshBasicMaterial({
                color: signalBaseColor,
                transparent: true,
                opacity: 0.08 - index * 0.02,
                side: THREE.DoubleSide
            });
            const fill = new THREE.Mesh(fillGeometry, fillMaterial);
            fill.rotation.x = -Math.PI / 2;
            fill.position.y = 0.02 + index * 0.02;
            routerGroup.add(fill);

            // 旋转虚线边框
            const dashBorderGeometry = new THREE.RingGeometry(radius - 0.03, radius, 64);
            const dashBorderMaterial = new THREE.MeshBasicMaterial({
                color: signalBaseColor,
                transparent: true,
                opacity: 0.4 - index * 0.1,
                side: THREE.DoubleSide,
                transparent: true
            });
            const dashBorder = new THREE.Mesh(dashBorderGeometry, dashBorderMaterial);
            dashBorder.rotation.x = -Math.PI / 2;
            dashBorder.position.y = 0.04 + index * 0.02;
            routerGroup.add(dashBorder);

            // 保存引用用于动画
            signalEffects.push({
                fill: fill,
                fillMaterial: fillMaterial,
                dashBorder: dashBorder,
                dashBorderMaterial: dashBorderMaterial,
                radius: radius,
                index: index,
                phase: index * Math.PI * 0.66
            });
        });

        // 添加脉冲波纹效果
        for (let i = 0; i < 3; i++) {
            const pulseRadius = 1.5 + i * 1;
            const pulseGeometry = new THREE.RingGeometry(pulseRadius - 0.02, pulseRadius + 0.02, 64);
            const pulseMaterial = new THREE.MeshBasicMaterial({
                color: signalBaseColor,
                transparent: true,
                opacity: 0,
                side: THREE.DoubleSide
            });
            const pulse = new THREE.Mesh(pulseGeometry, pulseMaterial);
            pulse.rotation.x = -Math.PI / 2;
            pulse.position.y = 0.05 + i * 0.02;
            routerGroup.add(pulse);

            signalEffects.push({
                pulse: pulse,
                pulseMaterial: pulseMaterial,
                pulseIndex: i,
                phase: i * 0.5
            });
        }

        routerGroup.userData.signalEffects = signalEffects;

        return routerGroup;
    }

    createTVModel(color) {
        const tvGroup = new THREE.Group();

        const standGeometry = new THREE.BoxGeometry(0.8, 0.1, 0.4);
        const standMaterial = new THREE.MeshStandardMaterial({
            color: 0x1a2540,
            roughness: 0.5,
            metalness: 0.4
        });
        const stand = new THREE.Mesh(standGeometry, standMaterial);
        stand.position.y = 0.05;
        tvGroup.add(stand);

        const bracketGeometry = new THREE.BoxGeometry(0.1, 0.3, 0.1);
        const bracket = new THREE.Mesh(bracketGeometry, standMaterial);
        bracket.position.set(0, 0.25, -0.1);
        tvGroup.add(bracket);

        const frameGeometry = new THREE.BoxGeometry(2, 1.2, 0.1);
        const frameMaterial = new THREE.MeshStandardMaterial({
            color: 0x1a2540,
            roughness: 0.3,
            metalness: 0.5
        });
        const frame = new THREE.Mesh(frameGeometry, frameMaterial);
        frame.position.y = 0.9;
        tvGroup.add(frame);

        const screenGeometry = new THREE.BoxGeometry(1.8, 1, 0.05);
        const screenMaterial = new THREE.MeshStandardMaterial({
            color: 0x88ccff,
            emissive: 0x88ccff,
            emissiveIntensity: 0.4,
            roughness: 0.1,
            metalness: 0.2
        });
        const screen = new THREE.Mesh(screenGeometry, screenMaterial);
        screen.position.set(0, 0.9, 0.03);
        tvGroup.add(screen);

        tvGroup.rotation.y = -Math.PI / 2;

        return tvGroup;
    }

    createONTModel(color) {
        const ontGroup = new THREE.Group();

        const mainGeometry = new THREE.BoxGeometry(1.8, 0.25, 1.2);
        const mainMaterial = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.4,
            metalness: 0.4
        });
        const main = new THREE.Mesh(mainGeometry, mainMaterial);
        main.position.y = 0.125;
        ontGroup.add(main);

        const panelGeometry = new THREE.BoxGeometry(1.6, 0.15, 0.05);
        const panelMaterial = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.5,
            metalness: 0.3
        });
        const panel = new THREE.Mesh(panelGeometry, panelMaterial);
        panel.position.set(0, 0.08, 0.58);
        ontGroup.add(panel);

        // LED指示灯
        const ledMaterial = new THREE.MeshBasicMaterial({
            color: 0x00c8ff,
            transparent: true,
            opacity: 0.8
        });
        const ledGeometry = new THREE.SphereGeometry(0.03, 8, 8);

        const ledColors = [0x00c8ff, 0x00c8ff, 0x34d399, 0x00c8ff];
        ledColors.forEach((ledColor, i) => {
            const ledMat = ledMaterial.clone();
            ledMat.color.setHex(ledColor);
            const led = new THREE.Mesh(ledGeometry, ledMat);
            led.position.set(-0.5 + i * 0.3, 0.08, 0.61);
            ontGroup.add(led);
        });

        // 端口指示（背面）
        const portGeometry = new THREE.BoxGeometry(0.15, 0.08, 0.02);
        const portMaterial = new THREE.MeshStandardMaterial({
            color: 0x3a4a65,
            roughness: 0.6,
            metalness: 0.4
        });

        for (let i = 0; i < 4; i++) {
            const port = new THREE.Mesh(portGeometry, portMaterial);
            port.position.set(-0.5 + i * 0.3, 0.05, -0.59);
            ontGroup.add(port);
        }

        return ontGroup;
    }

    add3DDevice(position, color, name, signal, type = 'default') {
        const group = new THREE.Group();
        group.position.set(...position);

        let modelGroup = null;
        if (type === 'router') {
            modelGroup = this.createRouterModel(color);
            group.add(modelGroup);
        } else if (type === 'tv') {
            modelGroup = this.createTVModel(color);
            group.add(modelGroup);
        } else if (type === 'ont') {
            modelGroup = this.createONTModel(color);
            group.add(modelGroup);
        }

        const label = this.createLabel(name, '#00c8ff', { x: 0, y: 2.5, z: 0 }, { x: 2, y: 0.5 }, { canvasHeight: 176, boxHeight: 160 });
        group.add(label);

        // 添加状态指示光环（实心圆形，用于显示告警状态）
        let statusRing = null;
        if (type === 'router' || type === 'ont') {
            const ringGeometry = new THREE.CircleGeometry(1.3, 32);
            const ringMaterial = new THREE.MeshBasicMaterial({
                color: 0x00ff00,
                transparent: true,
                opacity: 0,
                side: THREE.DoubleSide
            });
            statusRing = new THREE.Mesh(ringGeometry, ringMaterial);
            statusRing.rotation.x = -Math.PI / 2;
            statusRing.position.y = 0.05;
            group.add(statusRing);

            // 添加一个透明的大碰撞盒，使设备更容易被点击命中
            const hitboxGeo = new THREE.BoxGeometry(2.5, 2.5, 2.5);
            const hitboxMat = new THREE.MeshBasicMaterial({
                transparent: true,
                opacity: 0,
                depthWrite: false,
                side: THREE.DoubleSide
            });
            const hitbox = new THREE.Mesh(hitboxGeo, hitboxMat);
            hitbox.position.y = 1.0;
            hitbox.userData.deviceName = name;
            hitbox.userData.deviceType = type;
            hitbox.userData.clickable = true;
            hitbox.userData.isHitbox = true;
            group.add(hitbox);

            // 同时为已有模型组件打上标记（兜底）
            group.traverse(child => {
                child.userData.deviceName = name;
                child.userData.deviceType = type;
                child.userData.clickable = true;
            });
        }

        this.devices.push({
            group: group,
            signal: signal,
            baseColor: color,
            name: name,
            type: type,
            modelGroup: modelGroup,
            statusRing: statusRing,
            label: label
        });

        this.scene.add(group);
    }

    // 更新设备状态显示（离线、告警）
    updateDeviceStatus(deviceName, status, score) {
        const device = this.devices.find(d => d.name === deviceName);
        if (!device) return;

        // 存储设备状态供动画循环使用
        device.status = status;

        // 更新标签显示（名称 + 最新感知分值）
        this.updateDeviceLabel(device, score);

        if (!device.statusRing) return;

        const ringMaterial = device.statusRing.material;

        // 离线或未查询到状态：灰色半透明
        if (status === '离线' || status === undefined || status === null || status === '' ||
            (typeof score !== 'number')) {
            ringMaterial.color.setHex(0x888888);
            ringMaterial.opacity = 0.3;
            return;
        }

        // 根据分数显示告警状态：>90 绿、85-90 黄、<85 红
        if (score > 90) {
            // 正常 - 绿色
            ringMaterial.color.setHex(0x34d399);
            ringMaterial.opacity = 0.6;
        } else if (score >= 85) {
            // 警告 - 黄色
            ringMaterial.color.setHex(0xfbbf24);
            ringMaterial.opacity = 0.5;
        } else {
            // 告警 - 红色
            ringMaterial.color.setHex(0xf43f5e);
            ringMaterial.opacity = 0.6;
        }
    }

    // 更新设备标签：在名称下方显示最新感知分值
    updateDeviceLabel(device, score) {
        if (!device || !device.label) return;

        const texture = device.label.material.map;
        if (!texture) return;

        const canvas = texture.image;
        const ctx = canvas.getContext('2d');
        const color = '#00c8ff';
        const w = canvas.width;
        const boxHeight = canvas.height - 16;

        // 重绘背景
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const gradient = ctx.createLinearGradient(0, 0, w, 0);
        gradient.addColorStop(0, 'rgba(6, 10, 19, 0.92)');
        gradient.addColorStop(0.5, 'rgba(10, 16, 32, 0.95)');
        gradient.addColorStop(1, 'rgba(6, 10, 19, 0.92)');
        ctx.fillStyle = gradient;
        this.roundRect(ctx, 0, 0, w, boxHeight, 8);
        ctx.fill();

        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.7;
        this.roundRect(ctx, 0, 0, w, boxHeight, 8);
        ctx.stroke();
        ctx.globalAlpha = 1.0;

        const topLineGradient = ctx.createLinearGradient(0, 0, w, 0);
        topLineGradient.addColorStop(0, 'transparent');
        topLineGradient.addColorStop(0.3, color);
        topLineGradient.addColorStop(0.7, color);
        topLineGradient.addColorStop(1, 'transparent');
        ctx.strokeStyle = topLineGradient;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(8, 1);
        ctx.lineTo(248, 1);
        ctx.stroke();

        // 字体大小：名称 30px，分值 = 2 倍名称 = 60px
        const nameFontSize = 30;
        const scoreFontSize = nameFontSize * 2;

        // 第一行：设备名称（顶部居中）
        ctx.font = `bold ${nameFontSize}px Arial`;
        ctx.fillStyle = '#eaf4ff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = color;
        ctx.shadowBlur = 8;
        ctx.fillText(device.name, w / 2, nameFontSize);

        // 第二行：最新感知分值（下方居中，字体为名称的 2 倍）
        const scoreText = (typeof score === 'number' && score > 0) ? `${score}分` : '-';
        const scoreColor = (typeof score === 'number' && score > 90) ? '#34d399'
            : (typeof score === 'number' && score >= 85) ? '#fbbf24'
            : (typeof score === 'number' ? '#f43f5e' : '#888888');
        ctx.font = `bold ${scoreFontSize}px Arial`;
        ctx.fillStyle = scoreColor;
        ctx.shadowColor = scoreColor;
        ctx.shadowBlur = 8;
        ctx.fillText(scoreText, w / 2, boxHeight - scoreFontSize);
        ctx.shadowBlur = 0;

        texture.needsUpdate = true;
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

    createAmbientParticles() {
        const particleCount = 80;
        const positions = new Float32Array(particleCount * 3);
        const sizes = new Float32Array(particleCount);

        for (let i = 0; i < particleCount; i++) {
            positions[i * 3] = (Math.random() - 0.5) * 35;
            positions[i * 3 + 1] = Math.random() * 8;
            positions[i * 3 + 2] = (Math.random() - 0.5) * 20;
            sizes[i] = Math.random() * 0.08 + 0.02;
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

        const material = new THREE.PointsMaterial({
            color: 0x00c8ff,
            size: 0.06,
            transparent: true,
            opacity: 0.4,
            sizeAttenuation: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        this.ambientParticles = new THREE.Points(geometry, material);
        this.scene.add(this.ambientParticles);
    }

    animate() {
        this.animationId = requestAnimationFrame(() => this.animate());

        this.controls.update();

        if (this.globe) {
            this.globe.rotation.y += 0.01;
        }

        if (this.ambientParticles) {
            const positions = this.ambientParticles.geometry.attributes.position.array;
            const time = Date.now() * 0.0005;
            for (let i = 0; i < positions.length; i += 3) {
                positions[i + 1] += Math.sin(time + i) * 0.002;
                if (positions[i + 1] > 8) positions[i + 1] = 0;
                if (positions[i + 1] < 0) positions[i + 1] = 8;
            }
            this.ambientParticles.geometry.attributes.position.needsUpdate = true;
        }

        if (this.fiberConnections) {
            const dashOffset = (Date.now() * 0.003) % 20;

            for (const name in this.fiberConnections) {
                const conn = this.fiberConnections[name];
                if (!conn.material) continue;

                conn.material.dashSize = conn.baseDashSize + dashOffset;
            }
        }

        // 路由器信号区域动态效果
        const time = Date.now() * 0.001;
        this.devices.forEach(device => {
            if (!device.group) return;

            let signalEffects = null;

            // 从 router 类型的设备中获取 signalEffects
            device.group.children.forEach(child => {
                if (child.userData && child.userData.signalEffects) {
                    signalEffects = child.userData.signalEffects;
                }
            });

            if (signalEffects) {
                // 检查设备是否在线（支持中文'离线'和英文'offline'，未查询到的设备也视为离线）
                const isOnline = device.status && device.status !== '离线' && device.status !== 'offline';
                
                signalEffects.forEach((effect, idx) => {
                    if (!isOnline) {
                        // 离线状态：隐藏所有波纹效果
                        if (effect.fillMaterial) effect.fillMaterial.opacity = 0;
                        if (effect.dashBorderMaterial) effect.dashBorderMaterial.opacity = 0;
                        if (effect.pulseMaterial) effect.pulseMaterial.opacity = 0;
                        return;
                    }

                    // 呼吸灯效果 - 填充层透明度变化
                    if (effect.fillMaterial) {
                        const breathOpacity = (0.08 - effect.index * 0.02) * (0.5 + 0.5 * Math.sin(time * 2 + effect.phase));
                        effect.fillMaterial.opacity = Math.max(0.02, breathOpacity);
                    }

                    // 边框脉冲效果
                    if (effect.dashBorderMaterial) {
                        const borderOpacity = (0.4 - effect.index * 0.1) * (0.5 + 0.5 * Math.sin(time * 3 + effect.phase));
                        effect.dashBorderMaterial.opacity = Math.max(0.1, borderOpacity);
                    }

                    // 脉冲波纹扩散效果
                    if (effect.pulse && effect.pulseMaterial) {
                        const pulseTime = (time * 0.8 + effect.phase) % 3;
                        const pulseProgress = pulseTime / 3;

                        if (pulseProgress < 0.8) {
                            effect.pulseMaterial.opacity = (0.5 - pulseProgress * 0.5) * (1 - pulseProgress);
                        } else {
                            effect.pulseMaterial.opacity = 0;
                        }

                        const scale = 1 + pulseProgress * 0.5;
                        effect.pulse.scale.set(scale, scale, 1);
                    }
                });
            }
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