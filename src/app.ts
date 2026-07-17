// 24FI081 田村理志
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

class ThreeJSContainer {
    private scene!: THREE.Scene;
    private light!: THREE.Light;

    constructor() {

    }

    // 画面部分の作成(表示する枠ごとに)*
    public createRendererDOM = (width: number, height: number, cameraPos: THREE.Vector3) => {
        const renderer = new THREE.WebGLRenderer();
        renderer.setSize(width, height);
        renderer.setClearColor(new THREE.Color(0x495ed));
        renderer.shadowMap.enabled = true; //シャドウマップを有効にする

        //カメラの設定
        const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
        camera.position.copy(cameraPos);
        camera.lookAt(new THREE.Vector3(0, 0, 0));

        const orbitControls = new OrbitControls(camera, renderer.domElement);

        this.createScene();
        // 毎フレームのupdateを呼んで，render
        // reqestAnimationFrame により次フレームを呼ぶ
        const render: FrameRequestCallback = (_time) => {
            orbitControls.update();

            renderer.render(this.scene, camera);
            requestAnimationFrame(render);
        }
        requestAnimationFrame(render);

        renderer.domElement.style.cssFloat = "left";
        renderer.domElement.style.margin = "10px";
        return renderer.domElement;
    }

    // シーンの作成(全体で1回)
    private createScene = () => {
        this.scene = new THREE.Scene();

        // 蓄音機
        const goldMaterial = new THREE.MeshPhongMaterial({ color: 0xcca300, side: THREE.DoubleSide, shininess: 80 }); // 真鍮のラッパ
        const woodMaterial = new THREE.MeshPhongMaterial({ color: 0x5c3a21 }); // 木製の土台
        const vinylMaterial = new THREE.MeshPhongMaterial({ color: 0x111111, shininess: 50 }); // 黒いレコード

        const boxShape = new THREE.Shape();

        boxShape.moveTo(0.7, 0.8);
        boxShape.quadraticCurveTo(0.8, 0.8, 0.8, 0.7);
        boxShape.lineTo(0.8, -0.7);
        boxShape.quadraticCurveTo(0.8, -0.8, 0.7, -0.8);
        boxShape.lineTo(-0.7, -0.8);
        boxShape.quadraticCurveTo(-0.8, -0.8, -0.8, -0.7);
        boxShape.lineTo(-0.8, 0.7);
        boxShape.quadraticCurveTo(-0.8, 0.8, -0.7, 0.8);

        const extrudeSettings = {
            steps: 1,
            depth: 0.5,
            bevelEnabled: true,
            bevelThickness: 0.04,
            bevelSize: 0.02,
            bevelSegments: 3
        };

        const boxGeometry = new THREE.ExtrudeGeometry(boxShape, extrudeSettings);
        const boxMesh = new THREE.Mesh(boxGeometry, woodMaterial);

        boxMesh.rotation.x = -Math.PI / 2;
        boxMesh.position.y = -0.25;
        this.scene.add(boxMesh);

        const hornPoints: THREE.Vector2[] = [];
        const pointNum = 30;

        for (let i = 0; i < pointNum; i++) {
            const mathX = -1.5 + (i / (pointNum - 1)) * 2.5;
            const mathY = 0.4 * Math.exp(mathX);

            const x = mathY;
            const y = mathX;
            hornPoints.push(new THREE.Vector2(x, y));
        }

        const hornGeometry = new THREE.LatheGeometry(hornPoints, 32);
        const hornMesh = new THREE.Mesh(hornGeometry, goldMaterial);

        hornMesh.rotation.z = THREE.MathUtils.degToRad(-45); // 斜めに傾ける
        hornMesh.rotation.x = THREE.MathUtils.degToRad(15);
        hornMesh.position.set(0.3, 1, -0.3); // 土台の左奥から生やす
        this.scene.add(hornMesh);

        const recordShape = new THREE.Shape();
        recordShape.absellipse(0, 0, 0.6, 0.6, 0, Math.PI * 2, false, 0);

        // 真ん中穴開ける
        const recordHole = new THREE.Path();
        recordHole.absellipse(0, 0, 0.1, 0.1, 0, Math.PI * 2, false, 0);
        recordShape.holes.push(recordHole);

        const recordSettings = {
            steps: 1,
            depth: 0.02,
            bevelEnabled: false
        };

        const recordGeometry = new THREE.ExtrudeGeometry(recordShape, recordSettings);
        const recordMesh = new THREE.Mesh(recordGeometry, vinylMaterial);
        recordMesh.rotation.x = -Math.PI / 2;
        recordMesh.position.set(0.1, 0.3, 0.1); // 高さを微調整
        this.scene.add(recordMesh);

        //ライトの設定
        this.light = new THREE.DirectionalLight(0xffffff);
        const lvec = new THREE.Vector3(1, 1, 1).normalize();
        this.light.position.set(lvec.x, lvec.y, lvec.z);
        this.scene.add(this.light);

        // 毎フレームのupdateを呼んで，更新
        // reqestAnimationFrame により次フレームを呼ぶ
        const update: FrameRequestCallback = (_time) => {

            requestAnimationFrame(update);
        }
        requestAnimationFrame(update);
    }
}

window.addEventListener("DOMContentLoaded", init);

function init() {
    const container = new ThreeJSContainer();

    const viewport = container.createRendererDOM(640, 480, new THREE.Vector3(2, 2, 2));
    document.body.appendChild(viewport);
}
