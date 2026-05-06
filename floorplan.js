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

        const floorWidth = 14;
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

        const floorWidth = 14;
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
        this.createDevices();
    }

    createFloor() {
        const floorGeometry = new THREE.PlaneGeometry(14, 10);
        const floorMaterial = new THREE.MeshStandardMaterial({
            color: 0x1a1a2e,
            roughness: 0.8,
            metalness: 0.2
        });
        const floor = new THREE.Mesh(floorGeometry, floorMaterial);
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = 0;
        this.scene.add(floor);

        const gridHelper = new THREE.GridHelper(14, 14, 0x00d4ff, 0x00d4ff);
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
            { pos: [0, wallHeight / 2, -5], size: [14, wallHeight, wallThickness] },
            { pos: [0, wallHeight / 2, 5], size: [14, wallHeight, wallThickness] },
            { pos: [-7, wallHeight / 2, 0], size: [wallThickness, wallHeight, 10] },
            { pos: [7, wallHeight / 2, 0], size: [wallThickness, wallHeight, 10] }
        ];

        outerWalls.forEach(wall => {
            const geometry = new THREE.BoxGeometry(...wall.size);
            const mesh = new THREE.Mesh(geometry, wallMaterial);
            mesh.position.set(...wall.pos);
            this.scene.add(mesh);
        });

        const innerWalls = [
            { pos: [-4, wallHeight / 2, 1], size: [6, wallHeight, wallThickness] },
            { pos: [4, wallHeight / 2, 1], size: [6, wallHeight, wallThickness] },
            { pos: [-4, wallHeight / 2, -2], size: [wallThickness, wallHeight, 6] },
            { pos: [4, wallHeight / 2, -2], size: [wallThickness, wallHeight, 6] }
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

    createDevices() {
        const deviceData = [
            { pos: [3, 0.5, 3], color: 0x00d4ff, name: '光猫', signal: 95 },
            { pos: [0, 0.5, 3], color: 0x7b2cbf, name: '路由1', signal: 88 },
            { pos: [5.5, 0.5, -3], color: 0x7b2cbf, name: '路由2', signal: 82 },
            { pos: [2, 0.5, 0], color: 0x00f5d4, name: '手机', signal: 75 },
            { pos: [-5.5, 0.5, 3], color: 0xff6b6b, name: '电视', signal: 70 },
            { pos: [-5.5, 0.5, -3], color: 0xffd93d, name: '平板', signal: 65 }
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