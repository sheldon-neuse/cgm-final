import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import * as CANNON from "cannon-es";
import GUI from "lil-gui";

type BallState = "ready" | "pitched" | "hit" | "finished";

class ThreeJSContainer {
    private scene!: THREE.Scene;
    private world!: CANNON.World;
    private ballMesh!: THREE.Mesh;
    private ballBody!: CANNON.Body;
    private batGroup!: THREE.Group;
    private batBody!: CANNON.Body;
    private groundBody!: CANNON.Body;
    private statusElement!: HTMLDivElement;
    private distanceElement!: HTMLDivElement;

    private readonly clock = new THREE.Clock();
    private readonly pitchStart = new THREE.Vector3(0, 1.25, -18);
    private readonly batPivot = new THREE.Vector3(-1.2, 1.15, 0.15);
    private readonly guiObj = { pitchSpeed: 110 };

    private ballState: BallState = "ready";
    private swingActive = false;
    private swingTime = 0;
    private hitPosition = new THREE.Vector3();

    public createRendererDOM = (width: number, height: number, cameraPos: THREE.Vector3) => {
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setClearColor(0x87ceeb);
        renderer.shadowMap.enabled = true;

        const camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 1000);
        camera.position.copy(cameraPos);

        const orbitControls = new OrbitControls(camera, renderer.domElement);
        orbitControls.target.set(0, 1, 0);
        orbitControls.enablePan = false;  // 平行移動は禁止
        orbitControls.enableZoom = false; // 拡大・縮小は禁止
        orbitControls.enableDamping = true;
        orbitControls.update();

        this.createScene();

        const render: FrameRequestCallback = () => {
            const delta = Math.min(this.clock.getDelta(), 0.05);
            this.update(delta);
            orbitControls.update();
            renderer.render(this.scene, camera);
            requestAnimationFrame(render);
        };
        requestAnimationFrame(render);

        renderer.domElement.style.display = "block";
        return renderer.domElement;
    };

    private createScene = () => {
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.Fog(0x87ceeb, 45, 95);

        this.world = new CANNON.World({
            gravity: new CANNON.Vec3(0, -9.82, 0)
        });
        this.world.defaultContactMaterial.friction = 0.35;
        this.world.defaultContactMaterial.restitution = 0.45;

        this.createLights();
        this.createField();
        this.createBall();
        this.createBat();
        this.createGUI();
        this.createInformationPanel();

        document.addEventListener("keydown", this.onKeyDown);
        this.resetBall();
    };

    private createLights = () => {
        this.scene.add(new THREE.HemisphereLight(0xffffff, 0x3a5f32, 1.8));

        const light = new THREE.DirectionalLight(0xffffff, 2.2);
        light.position.set(-10, 18, 8);
        light.castShadow = true;
        light.shadow.mapSize.set(2048, 2048);
        this.scene.add(light);
    };

    private createField = () => {
        const groundMesh = new THREE.Mesh(
            new THREE.CircleGeometry(55, 96),
            new THREE.MeshPhongMaterial({ color: 0x3e8f43 })
        );
        groundMesh.rotation.x = -Math.PI / 2;
        groundMesh.receiveShadow = true;
        this.scene.add(groundMesh);

        const dirtMesh = new THREE.Mesh(
            new THREE.CircleGeometry(9, 64),
            new THREE.MeshPhongMaterial({ color: 0xb98752 })
        );
        dirtMesh.rotation.x = -Math.PI / 2;
        dirtMesh.position.y = 0.006;
        this.scene.add(dirtMesh);

        const plateShape = new THREE.Shape();
        plateShape.moveTo(-0.43, 0.22);
        plateShape.lineTo(0.43, 0.22);
        plateShape.lineTo(0.43, -0.22);
        plateShape.lineTo(0, -0.48);
        plateShape.lineTo(-0.43, -0.22);
        plateShape.closePath();
        const plate = new THREE.Mesh(
            new THREE.ShapeGeometry(plateShape),
            new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide })
        );
        plate.rotation.x = -Math.PI / 2;
        plate.position.set(0, 0.018, 0.45);
        this.scene.add(plate);

        this.groundBody = new CANNON.Body({ mass: 0 });
        this.groundBody.addShape(new CANNON.Plane());
        this.groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
        this.world.addBody(this.groundBody);

        // 投球方向と飛距離が分かりやすい目盛り線
        const lineMaterial = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 });
        for (let z = 10; z <= 50; z += 10) {
            const points = [new THREE.Vector3(-8, 0.025, z), new THREE.Vector3(8, 0.025, z)];
            this.scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), lineMaterial));
        }
    };

    private createBall = () => {
        this.ballMesh = new THREE.Mesh(
            new THREE.SphereGeometry(0.12, 24, 16),
            new THREE.MeshPhongMaterial({ color: 0xffffff })
        );
        this.ballMesh.castShadow = true;
        this.scene.add(this.ballMesh);

        this.ballBody = new CANNON.Body({
            mass: 0.145,
            shape: new CANNON.Sphere(0.12),
            linearDamping: 0.001
        });
        this.ballBody.addEventListener("collide", (event: { body: CANNON.Body }) => {
            if (event.body === this.batBody && this.ballState === "pitched") {
                this.hitBall();
            }
            if (event.body === this.groundBody && this.ballState === "hit") {
                this.finishHit();
            }
        });
        this.world.addBody(this.ballBody);
    };

    private createBat = () => {
        this.batGroup = new THREE.Group();
        this.batGroup.position.copy(this.batPivot);

        const batMesh = new THREE.Mesh(
            new THREE.CylinderGeometry(0.075, 0.14, 2.4, 20),
            new THREE.MeshPhongMaterial({ color: 0xd69b55, shininess: 80 })
        );
        batMesh.rotation.z = Math.PI / 2;
        batMesh.position.x = 1.2;
        batMesh.castShadow = true;
        this.batGroup.add(batMesh);
        this.scene.add(this.batGroup);

        // 衝突判定はバットに近い細長い直方体で安定させる
        this.batBody = new CANNON.Body({
            mass: 0,
            type: CANNON.Body.KINEMATIC,
            shape: new CANNON.Box(new CANNON.Vec3(1.2, 0.12, 0.12))
        });
        this.world.addBody(this.batBody);
        this.setBatAngle(-65);
    };

    private createGUI = () => {
        const gui = new GUI({ title: "投球設定" });
        gui.add(this.guiObj, "pitchSpeed", 60, 160, 1).name("球速 (km/h)");
    };

    private createInformationPanel = () => {
        const panel = document.createElement("div");
        panel.style.position = "fixed";
        panel.style.left = "18px";
        panel.style.top = "18px";
        panel.style.padding = "12px 16px";
        panel.style.color = "white";
        panel.style.background = "rgba(0, 0, 0, 0.65)";
        panel.style.borderRadius = "8px";
        panel.style.fontFamily = "sans-serif";
        panel.style.lineHeight = "1.7";
        panel.style.pointerEvents = "none";

        const controls = document.createElement("div");
        controls.textContent = "Space：投球　Enter：スイング　R：リセット";
        panel.appendChild(controls);

        this.statusElement = document.createElement("div");
        panel.appendChild(this.statusElement);

        this.distanceElement = document.createElement("div");
        this.distanceElement.style.fontSize = "24px";
        this.distanceElement.style.fontWeight = "bold";
        panel.appendChild(this.distanceElement);
        document.body.appendChild(panel);
    };

    private onKeyDown = (event: KeyboardEvent) => {
        if (event.repeat) return;

        if (event.code === "Space") {
            event.preventDefault();
            this.pitchBall();
        } else if (event.code === "Enter") {
            event.preventDefault();
            this.startSwing();
        } else if (event.code === "KeyR") {
            this.resetBall();
        }
    };

    private pitchBall = () => {
        if (this.ballState !== "ready" && this.ballState !== "finished") return;

        this.resetBall();
        this.ballState = "pitched";
        const speedMps = this.guiObj.pitchSpeed / 3.6;
        this.ballBody.velocity.set(0, 0, speedMps);
        this.statusElement.textContent = `${this.guiObj.pitchSpeed} km/h の直球を投げました`;
        this.distanceElement.textContent = "";
    };

    private startSwing = () => {
        if (this.swingActive) return;
        this.swingActive = true;
        this.swingTime = 0;
    };

    private setBatAngle = (angleDegree: number) => {
        const angle = THREE.MathUtils.degToRad(angleDegree);
        this.batGroup.rotation.y = angle;

        const offset = new THREE.Vector3(1.2, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
        const center = this.batPivot.clone().add(offset);
        this.batBody.position.set(center.x, center.y, center.z);
        this.batBody.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), angle);
    };

    private updateSwing = (delta: number) => {
        if (!this.swingActive) return;

        this.swingTime += delta;
        const duration = 0.32;
        const progress = Math.min(this.swingTime / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        this.setBatAngle(THREE.MathUtils.lerp(-65, 100, eased));

        if (progress >= 1) {
            this.swingActive = false;
            window.setTimeout(() => this.setBatAngle(-65), 250);
        }
    };

    private hitBall = () => {
        this.ballState = "hit";
        this.hitPosition.set(this.ballBody.position.x, 0, this.ballBody.position.z);

        // 当たった瞬間のバット角度から左右方向を決める
        const batAngle = this.batGroup.rotation.y;
        const sideDirection = THREE.MathUtils.clamp(Math.sin(batAngle) * 0.45, -0.45, 0.45);
        const exitSpeed = 18 + this.guiObj.pitchSpeed * 0.035;
        this.ballBody.velocity.set(
            sideDirection * exitSpeed,
            exitSpeed * 0.62,
            exitSpeed * 0.78
        );
        this.statusElement.textContent = "ヒット！ 打球を追跡中…";
    };

    private finishHit = () => {
        this.ballState = "finished";
        const landing = new THREE.Vector3(this.ballBody.position.x, 0, this.ballBody.position.z);
        const distance = landing.distanceTo(this.hitPosition);
        this.statusElement.textContent = distance >= 35 ? "ホームラン！" : "打球が着地しました";
        this.distanceElement.textContent = `飛距離：${distance.toFixed(1)} m`;
    };

    private resetBall = () => {
        this.ballState = "ready";
        this.ballBody.position.set(this.pitchStart.x, this.pitchStart.y, this.pitchStart.z);
        this.ballBody.velocity.setZero();
        this.ballBody.angularVelocity.setZero();
        this.ballBody.force.setZero();
        this.ballBody.wakeUp();
        this.swingActive = false;
        this.setBatAngle(-65);
        if (this.statusElement) this.statusElement.textContent = "Spaceキーで投球してください";
        if (this.distanceElement) this.distanceElement.textContent = "飛距離：-- m";
    };

    private update = (delta: number) => {
        this.updateSwing(delta);

        // 投球中だけ重力を打ち消し、高さが変化しない直球にする
        if (this.ballState === "ready" || this.ballState === "pitched") {
            this.ballBody.applyForce(
                new CANNON.Vec3(0, 9.82 * this.ballBody.mass, 0),
                this.ballBody.position
            );
        }

        this.world.step(1 / 60, delta, 4);
        this.ballMesh.position.set(
            this.ballBody.position.x,
            this.ballBody.position.y,
            this.ballBody.position.z
        );
        this.ballMesh.quaternion.set(
            this.ballBody.quaternion.x,
            this.ballBody.quaternion.y,
            this.ballBody.quaternion.z,
            this.ballBody.quaternion.w
        );

        if (this.ballState === "pitched" && this.ballBody.position.z > 5) {
            this.ballState = "finished";
            this.statusElement.textContent = "ストライク（または空振り）";
        }
    };
}

window.addEventListener("DOMContentLoaded", () => {
    document.body.style.margin = "0";
    document.body.style.overflow = "hidden";

    const container = new ThreeJSContainer();
    const viewport = container.createRendererDOM(
        window.innerWidth,
        window.innerHeight,
        new THREE.Vector3(8, 5, 11)
    );
    document.body.appendChild(viewport);
});