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
    private light!: THREE.Light;

    constructor() {

    }

    // 画面部分の作成（表示する枠ごとに）
    public createRendererDOM = (
        width: number,
        height: number,
        cameraPos: THREE.Vector3
    ) => {
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setClearColor(new THREE.Color(0x87ceeb));
        renderer.shadowMap.enabled = true;

        // カメラの設定
        const camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 1000);
        camera.position.copy(cameraPos);

        // ホームベース付近を注視する
        const homePosition = new THREE.Vector3(0, 1, 0.45);
        camera.lookAt(homePosition);

        const orbitControls = new OrbitControls(camera, renderer.domElement);
        orbitControls.target.copy(homePosition);
        orbitControls.enablePan = false;  // 平行移動は禁止
        orbitControls.enableZoom = false; // 拡大・縮小は禁止
        orbitControls.enableDamping = true;

        this.createScene();

        // 毎フレームrenderを呼び出す
        const render: FrameRequestCallback = (_time) => {
            orbitControls.update();
            renderer.render(this.scene, camera);
            requestAnimationFrame(render);
        };
        requestAnimationFrame(render);

        renderer.domElement.style.cssFloat = "left";
        renderer.domElement.style.margin = "10px";
        return renderer.domElement;
    };

    // シーンの作成（全体で1回）
    private createScene = () => {
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.Fog(0x87ceeb, 100, 220);

        // 物理演算用の空間
        const world = new CANNON.World({
            gravity: new CANNON.Vec3(0, -9.82, 0)
        });
        world.defaultContactMaterial.friction = 0.35;
        world.defaultContactMaterial.restitution = 0.45;

        // ライトの設定
        this.scene.add(new THREE.HemisphereLight(0xffffff, 0x3a5f32, 1.8));

        this.light = new THREE.DirectionalLight(0xffffff, 2.2);
        this.light.position.set(-10, 18, 8);
        this.light.castShadow = true;
        this.scene.add(this.light);

        // 球場・ボール・バットを生成
        const field = new Field(this.scene, world);
        const ball = new Ball(this.scene, world);

        const guiObj = {
            pitchSpeed: 110,
            battingSide: "右打席" as BattingSide
        };
        const bat = new Bat(this.scene, world, guiObj.battingSide);

        let ballState: BallState = "ready";
        let hitPosition = new THREE.Vector3();

        // 操作方法・判定結果を表示するパネル
        const panel = document.createElement("div");
        panel.style.position = "fixed";
        panel.style.left = "20px";
        panel.style.top = "20px";
        panel.style.padding = "12px 16px";
        panel.style.color = "white";
        panel.style.background = "rgba(0, 0, 0, 0.65)";
        panel.style.borderRadius = "8px";
        panel.style.fontFamily = "sans-serif";
        panel.style.lineHeight = "1.7";
        panel.style.pointerEvents = "none";

        const controlsElement = document.createElement("div");
        controlsElement.textContent = "Space：投球　Enter：スイング　R：リセット";
        panel.appendChild(controlsElement);

        const statusElement = document.createElement("div");
        panel.appendChild(statusElement);

        const distanceElement = document.createElement("div");
        distanceElement.style.fontSize = "24px";
        distanceElement.style.fontWeight = "bold";
        panel.appendChild(distanceElement);
        document.body.appendChild(panel);

        // ボールを初期状態へ戻す
        const resetBall = () => {
            ballState = "ready";
            ball.reset();
            bat.reset();
            statusElement.textContent = "Spaceキーで投球してください";
            distanceElement.textContent = "飛距離：-- m";
        };

        // バットに当たったボールを打球にする
        const hitBall = () => {
            ballState = "hit";
            hitPosition = ball.getPosition();
            hitPosition.y = 0;

            const batAngle = bat.getAngleRadians();
            const sideDirection = THREE.MathUtils.clamp(
                Math.sin(batAngle) * 0.35,
                -0.35,
                0.35
            );
            const exitSpeed = 26 + guiObj.pitchSpeed * 0.05;

            ball.queueHitVelocity(new CANNON.Vec3(
                sideDirection * exitSpeed,
                exitSpeed * 0.62,
                -exitSpeed * 0.78
            ));
            statusElement.textContent = "打球を追跡中…";
        };

        // 打球が着地したときに飛距離と結果を判定する
        const finishHit = () => {
            ballState = "finished";
            const landingPosition = ball.getPosition();
            landingPosition.y = 0;

            const distance = landingPosition.distanceTo(hitPosition);
            const isFair = field.isFair(hitPosition, landingPosition);

            if (!isFair) {
                statusElement.textContent = "ファウル";
            } else if (distance >= 100) {
                statusElement.textContent = "ホームラン！";
            } else {
                statusElement.textContent = "ヒット！";
            }
            distanceElement.textContent = `飛距離：${distance.toFixed(1)} m`;
        };

        // ボールとバット・地面の衝突判定
        ball.getBody().addEventListener(
            "collide",
            (event: { body: CANNON.Body }) => {
                if (event.body === bat.getBody() && ballState === "pitched") {
                    hitBall();
                }
                if (
                    event.body === field.getGroundBody()
                    && ballState === "hit"
                ) {
                    finishHit();
                }
            }
        );

        // GUIの設定
        const gui = new GUI({ title: "投球設定" });
        gui.add(guiObj, "pitchSpeed", 60, 160, 1).name("球速 (km/h)");
        gui.add(guiObj, "battingSide", ["右打席", "左打席"])
            .name("打席")
            .onChange(() => {
                bat.setBattingSide(guiObj.battingSide);
                statusElement.textContent = `${guiObj.battingSide}に変更しました`;
            });

        // キーボード操作
        document.addEventListener("keydown", (event) => {
            if (event.repeat) return;

            switch (event.code) {
                case "Space":
                    event.preventDefault();
                    if (ballState === "ready" || ballState === "finished") {
                        resetBall();
                        ballState = "pitched";
                        ball.pitch(guiObj.pitchSpeed);
                        statusElement.textContent = `${guiObj.pitchSpeed} km/h の直球を投げました`;
                        distanceElement.textContent = "";
                    }
                    break;

                case "Enter":
                    event.preventDefault();
                    bat.swing();
                    break;

                case "KeyR":
                    resetBall();
                    break;
            }
        });

        resetBall();

        // 毎フレームupdateを呼び、物理演算結果を画面へ反映する
        const update: FrameRequestCallback = (_time) => {
            bat.update(1 / 60);

            // 投球前と投球中は重力を打ち消して直球にする
            if (ballState === "ready" || ballState === "pitched") {
                ball.cancelGravity();
            }

            world.fixedStep();
            ball.afterPhysicsStep();

            if (ballState === "pitched" && ball.getPosition().z > 5) {
                ballState = "finished";
                statusElement.textContent = "ストライク（または空振り）";
            }

            requestAnimationFrame(update);
        };
        requestAnimationFrame(update);
    };
}

window.addEventListener("DOMContentLoaded", init);

function init() {
    document.body.style.margin = "0";
    document.body.style.overflow = "hidden";

    const container = new ThreeJSContainer();
    const viewport = container.createRendererDOM(
        960,
        640,
        new THREE.Vector3(8, 5, 11)
    );
    document.body.appendChild(viewport);
}