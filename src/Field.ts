import * as THREE from "three";
import * as CANNON from "cannon-es";

export class Field {
    private readonly groundBody: CANNON.Body;

    public constructor(scene: THREE.Scene, world: CANNON.World) {
        this.createGround(scene);
        this.createInfield(scene);
        this.createHomePlate(scene);
        this.createFoulLines(scene);
        this.createDistanceLines(scene);

        this.groundBody = new CANNON.Body({ mass: 0 });
        this.groundBody.addShape(new CANNON.Plane());
        this.groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
        world.addBody(this.groundBody);
    }

    public getGroundBody = () => {
        return this.groundBody;
    };

    public isFair = (hitPosition: THREE.Vector3, landingPosition: THREE.Vector3) => {
        const forwardDistance = hitPosition.z - landingPosition.z;
        const lateralDistance = Math.abs(landingPosition.x - hitPosition.x);
        return forwardDistance > 0 && lateralDistance <= forwardDistance;
    };

    private createGround = (scene: THREE.Scene) => {
        const groundMesh = new THREE.Mesh(
            new THREE.CircleGeometry(140, 128),
            new THREE.MeshPhongMaterial({ color: 0x3e8f43 })
        );
        groundMesh.rotation.x = -Math.PI / 2;
        groundMesh.receiveShadow = true;
        scene.add(groundMesh);
    };

    private createInfield = (scene: THREE.Scene) => {
        const dirtMesh = new THREE.Mesh(
            new THREE.CircleGeometry(9, 64),
            new THREE.MeshPhongMaterial({ color: 0xb98752 })
        );
        dirtMesh.rotation.x = -Math.PI / 2;
        dirtMesh.position.y = 0.006;
        scene.add(dirtMesh);
    };

    private createHomePlate = (scene: THREE.Scene) => {
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
        scene.add(plate);
    };

    private createFoulLines = (scene: THREE.Scene) => {
        const material = new THREE.LineBasicMaterial({ color: 0xffffff });
        const home = new THREE.Vector3(0, 0.03, 0.45);
        const firstBaseLine = [home, new THREE.Vector3(-120, 0.03, -119.55)];
        const thirdBaseLine = [home, new THREE.Vector3(120, 0.03, -119.55)];

        scene.add(new THREE.Line(
            new THREE.BufferGeometry().setFromPoints(firstBaseLine),
            material
        ));
        scene.add(new THREE.Line(
            new THREE.BufferGeometry().setFromPoints(thirdBaseLine),
            material
        ));
    };

    private createDistanceLines = (scene: THREE.Scene) => {
        const material = new THREE.LineBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.55
        });

        for (let z = -10; z >= -120; z -= 10) {
            const points = [
                new THREE.Vector3(-8, 0.025, z),
                new THREE.Vector3(8, 0.025, z)
            ];
            scene.add(new THREE.Line(
                new THREE.BufferGeometry().setFromPoints(points),
                material
            ));
        }
    };
}