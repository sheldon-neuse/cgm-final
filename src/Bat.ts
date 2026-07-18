import * as THREE from "three";
import * as CANNON from "cannon-es";

export type BattingSide = "右打席" | "左打席";

export class Bat {
    private readonly group: THREE.Group;
    private readonly mesh: THREE.Mesh;
    private readonly body: CANNON.Body;
    private readonly pivot = new THREE.Vector3(-1.2, 1.15, 0.15);

    private battingSide: BattingSide;
    private swingActive = false;
    private swingTime = 0;

    public constructor(
        scene: THREE.Scene,
        world: CANNON.World,
        battingSide: BattingSide = "右打席"
    ) {
        this.battingSide = battingSide;

        this.group = new THREE.Group();
        this.group.position.copy(this.pivot);

        this.mesh = new THREE.Mesh(
            new THREE.CylinderGeometry(0.075, 0.14, 2.4, 20),
            new THREE.MeshPhongMaterial({ color: 0xd69b55, shininess: 80 })
        );
        this.mesh.castShadow = true;
        this.group.add(this.mesh);
        scene.add(this.group);

        // バットに近い細長い直方体を衝突判定に使用する
        this.body = new CANNON.Body({
            mass: 0,
            type: CANNON.Body.KINEMATIC,
            shape: new CANNON.Box(new CANNON.Vec3(1.2, 0.12, 0.12))
        });
        // 接触イベントだけを利用し、ボールを物理的に押し返さない
        this.body.collisionResponse = false;
        world.addBody(this.body);

        this.setAngle(-65);
    }

    public getBody = (): CANNON.Body => {
        return this.body;
    };

    public getAngleRadians = (): number => {
        return this.group.rotation.y;
    };

    public setBattingSide = (battingSide: BattingSide): void => {
        this.battingSide = battingSide;
        this.reset();
    };

    public swing = (): void => {
        if (this.swingActive) return;
        this.swingActive = true;
        this.swingTime = 0;
    };

    public reset = (): void => {
        this.swingActive = false;
        this.swingTime = 0;
        this.setAngle(-65);
    };

    public update = (delta: number): void => {
        if (!this.swingActive) return;

        this.swingTime += delta;
        const duration = 0.32;
        const progress = Math.min(this.swingTime / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        this.setAngle(THREE.MathUtils.lerp(-65, 100, eased));

        if (progress >= 1) {
            this.swingActive = false;
            window.setTimeout(() => this.setAngle(-65), 250);
        }
    };

    private setAngle = (angleDegree: number): void => {
        const sideSign = this.battingSide === "右打席" ? 1 : -1;
        const angle = THREE.MathUtils.degToRad(angleDegree * sideSign);

        this.pivot.x = -1.2 * sideSign;
        this.group.position.copy(this.pivot);
        this.group.rotation.y = angle;

        this.mesh.position.x = 1.2 * sideSign;
        // 左打席では太い先端がボール側を向くようにする
        this.mesh.rotation.z = (Math.PI / 2) * sideSign;

        const offset = new THREE.Vector3(1.2 * sideSign, 0, 0)
            .applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
        const center = this.pivot.clone().add(offset);

        this.body.position.set(center.x, center.y, center.z);
        this.body.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), angle);
    };
}