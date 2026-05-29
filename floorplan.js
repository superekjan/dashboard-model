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
        this.createInternetConnection();
    }

    createFloor() {
        const floorGeometry = new THREE.PlaneGeometry(30, 15);
        const floorMaterial = new THREE.MeshStandardMaterial({
            color: 0x1a1a2e,
            roughness: 0.8,
            metalness: 0.2
        });
        const floor = new THREE.Mesh(floorGeometry, floorMaterial);
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = 0;
        this.scene.add(floor);

        const gridHelper = new THREE.GridHelper(30, 30, 0x00d4ff, 0x00d4ff);
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
        });

        const innerWalls = [
            // 左半部分 - 上下分隔卧室1和卧室2
            { pos: [-10, wallHeight / 2, 0], size: [10, wallHeight, wallThickness] },
            // 左半部分 - 与中间客厅的分隔
            { pos: [-5, wallHeight / 2, 0], size: [wallThickness, wallHeight, 15] },
            // 右上卧室3 - 与客厅的分隔
            { pos: [5, wallHeight / 2, -4.5], size: [wallThickness, wallHeight, 6] },
            // 右上卧室3 - 与走道的分隔
            { pos: [10, wallHeight / 2, -1.5], size: [10, wallHeight, wallThickness] },
            // 右下卧室4 - 与走道的分隔
            { pos: [10, wallHeight / 2, 1.5], size: [10, wallHeight, wallThickness] },
            // 右下卧室4 - 与客厅的分隔
            { pos: [5, wallHeight / 2, 4.5], size: [wallThickness, wallHeight, 6] }
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

    createBeds() {
        const bedMaterial = new THREE.MeshStandardMaterial({
            color: 0x8B4513,
            roughness: 0.8,
            metalness: 0.1
        });
        const mattressMaterial = new THREE.MeshStandardMaterial({
            color: 0xF5F5DC,
            roughness: 0.9,
            metalness: 0.0
        });
        const pillowMaterial = new THREE.MeshStandardMaterial({
            color: 0xFFFFFF,
            roughness: 0.9,
            metalness: 0.0
        });

        // 左上卧室的小床 - 床头向西（左边）贴墙
        this.createBed([-12.5, 0, -3.75], bedMaterial, mattressMaterial, pillowMaterial, 'west');
        // 左下卧室的小床 - 床头向西（左边）贴墙
        this.createBed([-12.5, 0, 3.75], bedMaterial, mattressMaterial, pillowMaterial, 'west');
        // 右下卧室的小床 - 床头向东（右边）贴墙
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
            color: 0x2c3e50,
            roughness: 0.8,
            metalness: 0.1
        });
        const tableMaterial = new THREE.MeshStandardMaterial({
            color: 0x8B4513,
            roughness: 0.6,
            metalness: 0.2
        });

        // 客厅右上角位置
        const centerX = 2;
        const centerZ = -4;

        // 茶几
        const tableGeometry = new THREE.BoxGeometry(2, 0.4, 1.2);
        const table = new THREE.Mesh(tableGeometry, tableMaterial);
        table.position.set(centerX, 0.2, centerZ);
        this.scene.add(table);

        // 沙发1 - 北边（上方）
        this.createSofa([centerX, 0, centerZ - 1.5], sofaMaterial, 'north');
        // 沙发2 - 南边（下方）
        this.createSofa([centerX, 0, centerZ + 1.5], sofaMaterial, 'south');
        // 沙发3 - 西边（左边）
        this.createSofa([centerX - 2, 0, centerZ], sofaMaterial, 'west');
        // 沙发4 - 东边（右边）
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
            color: 0xffffff,
            roughness: 0.8,
            metalness: 0.1
        });
        const glassMaterial = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.3,
            metalness: 0.1,
            transparent: true,
            opacity: 0.4
        });
        const chromeMaterial = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.5,
            metalness: 0.3
        });

        // 右上角浴室: x=5~15, z=-7.5~-1.5
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
        // 互联网标识 - 地球模型
        const globeGroup = new THREE.Group();
        const globeRadius = 1.2;

        // 地球主体
        const globeGeometry = new THREE.SphereGeometry(globeRadius, 32, 32);
        const globeMaterial = new THREE.MeshStandardMaterial({
            color: 0x1e90ff,
            roughness: 0.3,
            metalness: 0.5,
            emissive: 0x1e90ff,
            emissiveIntensity: 0.3
        });
        const globe = new THREE.Mesh(globeGeometry, globeMaterial);
        globeGroup.add(globe);

        // 地球经纬线
        const lineMaterial = new THREE.LineBasicMaterial({ color: 0x87ceeb, transparent: true, opacity: 0.5 });

        // 经线
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

        // 纬线
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

        // 互联网标识位置 - 站在地上，底部接触地面
        globeGroup.position.set(0, 1.2, -12);
        this.scene.add(globeGroup);
        this.globe = globeGroup;

        // 光猫位置
        const ontPosition = new THREE.Vector3(7, 0.5, 3.75);

        // 创建直线折线连接 - 沿着网格走线
        const linePoints = [
            new THREE.Vector3(0, 0.15, -12),    // 从地球底部垂直下到地面
            new THREE.Vector3(7, 0.15, -12),    // 沿地面水平走到x=7
            new THREE.Vector3(7, 0.15, 3.75),   // 沿地面水平走到z=3.75
            new THREE.Vector3(7, 0.5, 3.75)     // 垂直向上到光猫
        ];

        // 创建折线几何体
        const lineGeometry = new THREE.BufferGeometry();
        const combinedPoints = [];

        for (let i = 0; i < linePoints.length - 1; i++) {
            const start = linePoints[i];
            const end = linePoints[i + 1];
            const steps = 20;
            for (let j = 0; j <= steps; j++) {
                const t = j / steps;
                combinedPoints.push(
                    start.x + (end.x - start.x) * t,
                    start.y + (end.y - start.y) * t,
                    start.z + (end.z - start.z) * t
                );
            }
        }

        lineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(combinedPoints, 3));

        // 发光线材质
        const glowMaterial = new THREE.LineBasicMaterial({
            color: 0x00d4ff,
            transparent: true,
            opacity: 0.8
        });

        const connectionLine = new THREE.Line(lineGeometry, glowMaterial);
        this.scene.add(connectionLine);

        // 创建长粒子（使用线段）
        const particleCount = 20;
        this.internetParticleLines = [];
        this.connectionSegments = [];
        this.connectionLinePoints = linePoints;

        // 预计算各段长度
        let totalLength = 0;
        for (let i = 0; i < linePoints.length - 1; i++) {
            const start = linePoints[i];
            const end = linePoints[i + 1];
            const length = start.distanceTo(end);
            this.connectionSegments.push({ start, end, length, offset: totalLength });
            totalLength += length;
        }

        // 创建长粒子线段
        for (let i = 0; i < particleCount; i++) {
            const particleLength = 0.8; // 粒子长度
            const particleGeometry = new THREE.BufferGeometry();
            const positions = new Float32Array(6);
            particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

            const particleMaterial = new THREE.LineBasicMaterial({
                color: 0x00ffff,
                transparent: true,
                opacity: 1
            });

            const particleLine = new THREE.Line(particleGeometry, particleMaterial);
            this.scene.add(particleLine);
            this.internetParticleLines.push({ line: particleLine, length: particleLength });
        }

        // 光猫到路由器1的光纤连接（地面上走线）
        const router1Position = new THREE.Vector3(-7, 0.5, -3.75);
        this.createFiberConnection(
            new THREE.Vector3(7, 0.15, 3.75),
            new THREE.Vector3(-7, 0.15, -3.75),
            0x00d4ff, 'fiber1'
        );

        // 光猫到路由器2的光纤连接（地面上走线）
        const router2Position = new THREE.Vector3(-7, 0.5, 3.75);
        this.createFiberConnection(
            new THREE.Vector3(7, 0.15, 3.75),
            new THREE.Vector3(-7, 0.15, 3.75),
            0x00d4ff, 'fiber2'
        );
    }

    createFiberConnection(startPos, endPos, color, name) {
        // 创建直线光纤连接
        const linePoints = [
            startPos.clone(),
            endPos.clone()
        ];

        // 创建折线几何体
        const lineGeometry = new THREE.BufferGeometry();
        const combinedPoints = [];

        for (let i = 0; i < linePoints.length - 1; i++) {
            const start = linePoints[i];
            const end = linePoints[i + 1];
            const steps = 20;
            for (let j = 0; j <= steps; j++) {
                const t = j / steps;
                combinedPoints.push(
                    start.x + (end.x - start.x) * t,
                    start.y + (end.y - start.y) * t,
                    start.z + (end.z - start.z) * t
                );
            }
        }

        lineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(combinedPoints, 3));

        const glowMaterial = new THREE.LineBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.8
        });

        const connectionLine = new THREE.Line(lineGeometry, glowMaterial);
        this.scene.add(connectionLine);

        // 创建长粒子
        const particleCount = 5;
        const particles = [];
        const segments = [];

        let totalLength = 0;
        for (let i = 0; i < linePoints.length - 1; i++) {
            const start = linePoints[i];
            const end = linePoints[i + 1];
            const length = start.distanceTo(end);
            segments.push({ start, end, length, offset: totalLength });
            totalLength += length;
        }

        for (let i = 0; i < particleCount; i++) {
            const particleLength = 0.6;
            const particleGeometry = new THREE.BufferGeometry();
            const positions = new Float32Array(6);
            particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

            const particleMaterial = new THREE.LineBasicMaterial({
                color: 0x00ffff,
                transparent: true,
                opacity: 1
            });

            const particleLine = new THREE.Line(particleGeometry, particleMaterial);
            this.scene.add(particleLine);
            particles.push({ line: particleLine, length: particleLength });
        }

        // 存储以用于动画
        if (!this.fiberConnections) {
            this.fiberConnections = {};
        }
        this.fiberConnections[name] = { particles, segments, linePoints };
    }

    getPointOnSegments(t) {
        if (!this.connectionSegments || this.connectionSegments.length === 0) {
            return new THREE.Vector3(0, 0, 0);
        }

        const totalLength = this.connectionSegments[this.connectionSegments.length - 1].offset +
            this.connectionSegments[this.connectionSegments.length - 1].length;

        const distance = t * totalLength;

        for (const segment of this.connectionSegments) {
            if (distance <= segment.offset + segment.length) {
                const localT = (distance - segment.offset) / segment.length;
                return new THREE.Vector3(
                    segment.start.x + (segment.end.x - segment.start.x) * localT,
                    segment.start.y + (segment.end.y - segment.start.y) * localT,
                    segment.start.z + (segment.end.z - segment.start.z) * localT
                );
            }
        }

        return this.connectionSegments[this.connectionSegments.length - 1].end;
    }

    createDevices() {
        const deviceData = [
            { pos: [-7, 0.5, -3.75], color: 0x7b2cbf, name: '路由1', signal: 88 },
            { pos: [-7, 0.5, 3.75], color: 0x7b2cbf, name: '路由2', signal: 82 },
            { pos: [3, 0.5, 5], color: 0xff6b6b, name: '电视', signal: 70 },
            { pos: [7, 0.5, 3.75], color: 0x00d4ff, name: '光猫', signal: 95 }
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

        // 地球旋转动画
        if (this.globe) {
            this.globe.rotation.y += 0.01;
        }

        // 互联网入口长粒子动画
        if (this.internetParticleLines && this.connectionSegments) {
            for (let i = 0; i < this.internetParticleLines.length; i++) {
                const particle = this.internetParticleLines[i];
                let t = (Date.now() * 0.0003 + i / this.internetParticleLines.length) % 1;

                const startPoint = this.getPointOnSegments(t);
                const endPoint = this.getPointOnSegments((t - particle.length / this.getTotalLength()) % 1);

                const positions = particle.line.geometry.attributes.position.array;
                positions[0] = startPoint.x;
                positions[1] = startPoint.y;
                positions[2] = startPoint.z;
                positions[3] = endPoint.x;
                positions[4] = endPoint.y;
                positions[5] = endPoint.z;

                particle.line.geometry.attributes.position.needsUpdate = true;
            }
        }

        // 光纤连接动画（光猫到路由器）
        if (this.fiberConnections) {
            for (const name in this.fiberConnections) {
                const conn = this.fiberConnections[name];
                if (!conn.particles || !conn.segments) continue;

                const totalLength = conn.segments[conn.segments.length - 1].offset +
                    conn.segments[conn.segments.length - 1].length;

                for (let i = 0; i < conn.particles.length; i++) {
                    const particle = conn.particles[i];
                    let t = (Date.now() * 0.00025 + i / conn.particles.length) % 1;

                    const startPoint = this.getPointOnFiber(t, conn.segments, totalLength);
                    const endPoint = this.getPointOnFiber((t - particle.length / totalLength + 1) % 1, conn.segments, totalLength);

                    const positions = particle.line.geometry.attributes.position.array;
                    positions[0] = startPoint.x;
                    positions[1] = startPoint.y;
                    positions[2] = startPoint.z;
                    positions[3] = endPoint.x;
                    positions[4] = endPoint.y;
                    positions[5] = endPoint.z;

                    particle.line.geometry.attributes.position.needsUpdate = true;
                }
            }
        }

        this.renderer.render(this.scene, this.camera);
    }

    getTotalLength() {
        if (!this.connectionSegments || this.connectionSegments.length === 0) return 1;
        return this.connectionSegments[this.connectionSegments.length - 1].offset +
            this.connectionSegments[this.connectionSegments.length - 1].length;
    }

    getPointOnFiber(t, segments, totalLength) {
        if (!segments || segments.length === 0) {
            return new THREE.Vector3(0, 0, 0);
        }

        const distance = t * totalLength;

        for (const segment of segments) {
            if (distance <= segment.offset + segment.length) {
                const localT = (distance - segment.offset) / segment.length;
                return new THREE.Vector3(
                    segment.start.x + (segment.end.x - segment.start.x) * localT,
                    segment.start.y + (segment.end.y - segment.start.y) * localT,
                    segment.start.z + (segment.end.z - segment.start.z) * localT
                );
            }
        }

        return segments[segments.length - 1].end;
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