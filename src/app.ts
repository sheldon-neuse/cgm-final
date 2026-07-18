import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import * as CANNON from "cannon-es";
import GUI from "lil-gui";
import { Bat, type BattingSide } from "./Bat";
import { Ball } from "./Ball";
import { Field } from "./Field";

type BallState = "ready" | "pitched" | "hit" | "finished";

class ThreeJSContainer {
    private scene!: THREE.Scene;
    private world!: CANNON.World;
    private bat!: Bat;
    private ball!: Ball;
    private field!: Field;
    private statusElement!: HTMLDivElement;
    private distanceElement!: HTMLDivElement;

    private readonly clock = new THREE.Clock();
    private readonly guiObj = {
        pitchSpeed: 110,
        battingSide: "右打席" as BattingSide
    };

    private ballState: BallState = "ready";
    private hitPosition = new THREE.Vector3();

    public createRendererDOM = (
        width: number,
        height: number,
        cameraPos: THREE.Vector3
    ): HTMLCanvasElement => {
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setClearColor(0x87ceeb);
        renderer.shadowMap.enabled = true;

        const camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 1000);
        camera.position.copy(cameraPos);

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.target.set(0, 1, 0);
        controls.enablePan = false;
        controls.enableZoom = false;
        controls.enableDamping = true;
        controls.update();

        this.createScene();

        const render: FrameRequestCallback = () => {
            const delta = Math.min(this.clock.getDelta(), 0.05);
            this.update(delta);
            controls.update();
            renderer.render(this.scene, camera);
            requestAnimationFrame(render);
        };
        requestAnimationFrame(render);

        renderer.domElement.style.display = "block";
        return renderer.domElement;
    };

    private createScene = (): void => {
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.Fog(0x87ceeb, 100, 220);

        this.world = new CANNON.World({
            gravity: new CANNON.Vec3(0, -9.82, 0)
        });
        this.world.defaultContactMaterial.friction = 0.35;
        this.world.defaultContactMaterial.restitution = 0.45;

        this.createLights();
        this.field = new Field(this.scene, this.world);
        this.ball = new Ball(this.scene, this.world);
        this.bat = new Bat(this.scene, this.world, this.guiObj.battingSide);
        this.setupCollisionEvents();
        this.createGUI();
        this.createInformationPanel();

        document.addEventListener("keydown", this.onKeyDown);
        this.resetBall();
    };

    private createLights = (): void => {
        this.scene.add(new THREE.HemisphereLight(0xffffff, 0x3a5f32, 1.8));

        const light = new THREE.DirectionalLight(0xffffff, 2.2);
        light.position.set(-10, 18, 8);
        light.castShadow = true;
        light.shadow.mapSize.set(2048, 2048);
        this.scene.add(light);
    };

    private setupCollisionEvents = (): void => {
        this.ball.getBody().addEventListener(
            "collide",
            (event: { body: CANNON.Body }) => {
                if (event.body === this.bat.getBody() && this.ballState === "pitched") {
                    this.hitBall();
                }
                if (
                    event.body === this.field.getGroundBody()
                    && this.ballState === "hit"
                ) {
                    this.finishHit();
                }
            }
        );
    };

    private createGUI = (): void => {
        const gui = new GUI({ title: "投球設定" });
        gui.add(this.guiObj, "pitchSpeed", 60, 160, 1).name("球速 (km/h)");
        gui.add(this.guiObj, "battingSide", ["右打席", "左打席"])
            .name("打席")
            .onChange(() => {
                this.bat.setBattingSide(this.guiObj.battingSide);
                this.statusElement.textContent = `${this.guiObj.battingSide}に変更しました`;
            });
    };

    private createInformationPanel = (): void => {
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

    private onKeyDown = (event: KeyboardEvent): void => {
        if (event.repeat) return;

        if (event.code === "Space") {
            event.preventDefault();
            this.pitchBall();
        } else if (event.code === "Enter") {
            event.preventDefault();
            this.bat.swing();
        } else if (event.code === "KeyR") {
            this.resetBall();
        }
    };

    private pitchBall = (): void => {
        if (this.ballState !== "ready" && this.ballState !== "finished") return;

        this.resetBall();
        this.ballState = "pitched";
        this.ball.pitch(this.guiObj.pitchSpeed);
        this.statusElement.textContent = `${this.guiObj.pitchSpeed} km/h の直球を投げました`;
        this.distanceElement.textContent = "";
    };

    private hitBall = (): void => {
        this.ballState = "hit";
        this.hitPosition = this.ball.getPosition();
        this.hitPosition.y = 0;

        const batAngle = this.bat.getAngleRadians();
        const sideDirection = THREE.MathUtils.clamp(
            Math.sin(batAngle) * 0.35,
            -0.35,
            0.35
        );
        const exitSpeed = 26 + this.guiObj.pitchSpeed * 0.05;

        this.ball.queueHitVelocity(new CANNON.Vec3(
            sideDirection * exitSpeed,
            exitSpeed * 0.62,
            -exitSpeed * 0.78
        ));
        this.statusElement.textContent = "打球を追跡中…";
    };

    private finishHit = (): void => {
        this.ballState = "finished";
        const landingPosition = this.ball.getPosition();
        landingPosition.y = 0;
        const distance = landingPosition.distanceTo(this.hitPosition);
        const isFair = this.field.isFair(this.hitPosition, landingPosition);

        if (!isFair) {
            this.statusElement.textContent = "ファウル";
        } else if (distance >= 100) {
            this.statusElement.textContent = "ホームラン！";
        } else {
            this.statusElement.textContent = "ヒット！";
        }
        this.distanceElement.textContent = `飛距離：${distance.toFixed(1)} m`;
    };

    private resetBall = (): void => {
        this.ballState = "ready";
        this.ball.reset();
        this.bat.reset();
        if (this.statusElement) {
            this.statusElement.textContent = "Spaceキーで投球してください";
        }
        if (this.distanceElement) {
            this.distanceElement.textContent = "飛距離：-- m";
        }
    };

    private update = (delta: number): void => {
        this.bat.update(delta);

        if (this.ballState === "ready" || this.ballState === "pitched") {
            this.ball.cancelGravity();
        }

        this.world.step(1 / 60, delta, 4);
        this.ball.afterPhysicsStep();

        if (this.ballState === "pitched" && this.ball.getPosition().z > 5) {
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