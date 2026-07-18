import * as THREE from "three";
import * as CANNON from "cannon-es";

export class Ball {
    private readonly mesh: THREE.Mesh;
    private readonly body: CANNON.Body;
    private readonly startPosition = new THREE.Vector3(0, 1.25, -18);
    private pendingVelocity: CANNON.Vec3 | null = null;

    public constructor(scene: THREE.Scene, world: CANNON.World) {
        this.mesh = new THREE.Mesh(
            new THREE.SphereGeometry(0.12, 24, 16),
            new THREE.MeshPhongMaterial({ color: 0xffffff })
        );
        this.mesh.castShadow = true;
        scene.add(this.mesh);

        this.body = new CANNON.Body({
            mass: 0.145,
            shape: new CANNON.Sphere(0.12),
            linearDamping: 0.001
        });
        world.addBody(this.body);
        this.reset();
    }

    public getBody = (): CANNON.Body => {
        return this.body;
    };

    public getPosition = (): THREE.Vector3 => {
        return new THREE.Vector3(
            this.body.position.x,
            this.body.position.y,
            this.body.position.z
        );
    };

    public pitch = (speedKmh: number): void => {
        this.body.velocity.set(0, 0, speedKmh / 3.6);
        this.body.wakeUp();
    };

    public queueHitVelocity = (velocity: CANNON.Vec3): void => {
        // world.step後に設定することで、衝突ソルバーによる上書きを防ぐ
        this.pendingVelocity = velocity.clone();
    };

    public cancelGravity = (): void => {
        this.body.applyForce(
            new CANNON.Vec3(0, 9.82 * this.body.mass, 0),
            this.body.position
        );
    };

    public afterPhysicsStep = (): void => {
        if (this.pendingVelocity !== null) {
            this.body.velocity.copy(this.pendingVelocity);
            this.pendingVelocity = null;
        }
        this.syncMesh();
    };

    public reset = (): void => {
        this.body.position.set(
            this.startPosition.x,
            this.startPosition.y,
            this.startPosition.z
        );
        this.body.velocity.setZero();
        this.body.angularVelocity.setZero();
        this.body.force.setZero();
        this.pendingVelocity = null;
        this.body.wakeUp();
        this.syncMesh();
    };

    private syncMesh = (): void => {
        this.mesh.position.set(
            this.body.position.x,
            this.body.position.y,
            this.body.position.z
        );
        this.mesh.quaternion.set(
            this.body.quaternion.x,
            this.body.quaternion.y,
            this.body.quaternion.z,
            this.body.quaternion.w
        );
    };
}