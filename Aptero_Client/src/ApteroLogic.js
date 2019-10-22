import {MODE_DRAW, POINT_RADIUS} from "./common/Color";
import {Paint3dDrawService} from "./service/Paint3dDrawService";
import type {ControllerState} from "./controller/ControllerService";
import {rotateByQuaternion} from "./common/MathUtil";
import {PeerjsService} from "./service/PeerjsService";
import {controllerService} from "./controller/ControllerService";
import KeyboardCameraController from "./controller/KeyboardCameraController";
import {RoomsAPI} from "./service/RoomsAPI";
import type {Raycaster} from "react-360-web/js/Controls/Raycasters/Types";
import {Vector3, Quaternion} from 'three';

let FPS60 = 1000 / 60;
let FPS24 = 1000 / 24;

export class CustomRayCaster implements Raycaster{
    drawsCursor(): boolean{
        return true;
    }
    fillDirection(direction: Vec3): boolean{
        console.log("direction:"+direction);
        return false;
    }
    fillOrigin(origin: Vec3): boolean{
        console.log("origin:"+origin);
        return false;
    }
    getMaxLength(): number{
        return Infinity;
    }
    getType(): string{
        return 'mouse';
    }
    hasAbsoluteCoordinates(): boolean{
        return false;
    }
}


export class ApteroLogic {
    bridgeModule;
    colorModule;
    peerJsService:PeerjsService;
    paint3d;
    r360;
    knownHandIds: { [id: string]: { [id: number]: any } } = {};
    inputAvailable: boolean[] = [];
    lastInputState: boolean[] = [];

    update() {

        /**
         //hand mapping
         **/
        let controllerServiceLoc = controllerService;
        if(controllerServiceLoc.getGamepads().length==0){
            let pos = this.r360.getCameraPosition();
            let quat = this.r360.getCameraQuaternion();
            let posVector = new Vector3(pos[0],pos[1],pos[2]);
            let quaternion = new Quaternion(quat[0],quat[1],quat[2],quat[3]);
            let ray = new Vector3(0,0,-0.5).applyQuaternion(quaternion);
            let ret:Vector3 = posVector.add(ray);
            let rotEuler = controllerServiceLoc.convertQuaternionToEuler(quat);
            if(this.peerJsService) {
                this.processHand(this.peerJsService.peerjs.id, 99, {
                    position: [ret.x,ret.y,ret.z],
                    rotation: rotEuler,
                    pressed: false,
                });
                //this.drawAt(ret.x,ret.y,ret.z);
            }
        }else {
            controllerServiceLoc.getGamepads().forEach(gamepad => {
                if (gamepad.isVRReady()) {
                    let handId = gamepad.index;
                    let gstate = gamepad.getControllerState();
                    this.processHand(this.peerJsService.peerjs.id, handId, gstate);
                    if (this.lastInputState[handId] !== gamepad.isPressed()) {
                        //detect change in input
                        //Prevent drawing on click / drawing is only available on pressed behavior
                        this.lastInputState[handId] = gamepad.isPressed();
                        this.inputAvailable[handId] = false;
                        setTimeout(() => {
                            console.log("input available");
                            this.inputAvailable[handId] = true;
                        }, 200)
                    }
                    if (gamepad.isPressed() && this.inputAvailable[handId]) {
                        let pos = gamepad.getHandPointer();
                        this.drawAt(pos[0],pos[1],pos[2]);
                    }
                }
            });
        }
    }

    drawAt(x,y,z){
        if (this.colorModule.getMode() === MODE_DRAW) {
            this.paint3d.addPointIfNotPresent(x, y, z, POINT_RADIUS, {
                id: this.paint3d.getNextUniqueId(),
                color: this.colorModule.getColor(),
                origin: this.peerJsService.peerjs.id
            });
        } else {
            console.log("remove");
            this.paint3d.removePointNear(x, y, z, POINT_RADIUS * 4);
        }
    }

    setupReact360() {

        this.r360.renderToSurface(this.r360.createRoot('HeadLockMenu360'), this.r360.getDefaultSurface());

        this.r360.renderToLocation(
            this.r360.createRoot('Room'),
            this.r360.getDefaultLocation(),
        );

        this.r360.renderToLocation(
            this.r360.createRoot('Env'),
            this.r360.getDefaultLocation(),
        );

        // Load the initial environment
        this.r360.compositor.setBackground(this.r360.getAssetURL('360WorldSun.jpg'));
        this.r360.controls.addCameraController(new KeyboardCameraController());

        this.r360.renderToLocation(
            this.r360.createRoot("Points", {}),
            this.r360.getDefaultLocation()
        );
    }

    /*
    Input and hand processing
     */
    processHand(id: string, handId: number, data: ControllerState) {
        if (!this.knownHandIds[id]) {
            this.knownHandIds[id] = {};
        }
        if (!this.knownHandIds[id][handId]) {
            this.knownHandIds[id][handId] = true;
            console.log("new hand");
            this.r360.renderToLocation(
                this.r360.createRoot("ParticipantHand", {
                    id: id, handId: handId, startVisible: true
                }),
                this.r360.getDefaultLocation()
            );
        } else {
            this.bridgeModule.emit("setHandTransform", {
                id: id,
                handId: handId,
                ...data
            })
        }
    }

    loadPersistentData(){
        console.log("load persistent data");
        let points = this.peerJsService.getRoomData()["points"] || {};
        Object.keys(points).forEach(key => {
            let point = points[key];
            this.paint3d.addPointIfNotPresent(point.x, point.y, point.z, POINT_RADIUS, point);
        });
        console.log("finished persistent data");
    }

    setupNetwork() {
        /*
         * Handle room connection
         */
        let host = window.location.href.startsWith("https://") ? "https://meeting.aptero.co" : "http://127.0.0.1:6767";
        console.log("backend:" + host);
        let roomsAPI:RoomsAPI = new RoomsAPI(host);
        this.peerJsService = new PeerjsService(roomsAPI);
        let split = window.location.href.split("#");
        if (split.length === 2) {
            console.log("joining room : " + split[1]);
            let roomId = split[1].split("/")[1];
            this.peerJsService.setCall(roomId).then(() => {
                this.loadPersistentData();
            });
        } else {
            console.log("creating room");
            this.peerJsService.createCall().then(() => {
                window.location.href = "index.html#room/" + this.peerJsService.getCurrentRoomId();
                this.loadPersistentData();
            })
        }


        window.onunload = () => {
            this.peerJsService.roomApi.unregisterIdWithServerAPI(this.peerJsService.getCurrentRoomId(),this.peerJsService.getMyPeerJsId())
        };

        /*
         * Handle network event
         */
        this.peerJsService.eventEmitter.on("new_user", (event: {
            event: string,
            data: {
                id: string
            }
        }) => {
            let id = event.data.id;
            this.r360.renderToLocation(
                this.r360.createRoot("ParticipantHead", {
                    id: id, startVisible: true
                }),
                this.r360.getDefaultLocation()
            );
        });

        this.peerJsService.eventEmitter.on("new_point", (event: {
            event: string,
            data: { id: string, x: number, y: number, z: number, color: string }
        }) => {
            let point = event.data;
            this.paint3d.addPointIfNotPresent(point.x, point.y, point.z, POINT_RADIUS, point);
        });

        this.peerJsService.eventEmitter.on("remove_point", (event: {
            event: string,
            data: { id: string, x: number, y: number, z: number, color: string }
        }) => {
            let point = event.data;
            this.paint3d.removePointNear(point.x, point.y, point.z, POINT_RADIUS);
        });


        this.peerJsService.eventEmitter.on("disconnected", (event: {
            event: "disconnected",
            data: {
                id: string
            }
        }) => {
            this.bridgeModule.emit("setHeadTransform", {id: event.data.id, position: [], rotation: []});
        });

        this.peerJsService.eventEmitter.on("player_state", (event: {
            event: "player_state",
            data: {
                id: string,
                position: number[],
                rotation: number[],
                hands: {
                    [id: number]: {
                        position: number[],
                        rotation: number[],
                        pressed: boolean,
                    }
                }
            }
        }) => {
            let id = event.data.id;
            let position = event.data.position;
            let rotation = event.data.rotation;
            this.bridgeModule.emit("setHeadTransform", {id: id, position: position, rotation: rotation});
            let hands = event.data.hands;
            Object.keys(hands).forEach((handId) => {
                this.processHand(id, handId, hands[handId]);
            });

        });

        /*
         * send network event
         */

        /* paint 3d */
        this.paint3d = new Paint3dDrawService();
        this.paint3d.onPointAdded(data => {
            this.bridgeModule.emit("newPoint", data);
            if (data.origin === this.peerJsService.peerjs.id) {
                //if we created the point we broadcast to others
                this.peerJsService.broadcastData("new_point", data);
                this.peerJsService.updateRoomData(data.pointid,data);
            }
        });
        this.paint3d.onPointRemoved(data => {
            this.bridgeModule.emit("removePoint", data);
            if (data.origin === this.peerJsService.peerjs.id) {
                //if we created the point we broadcast to others
                this.peerJsService.broadcastData("remove_point", data);
            }
        });

        let payload = {id: this.peerJsService.getMyPeerJsId(), hands: {}};
        //network loop at 24 FPS
        setInterval(() => {
            /*
             * network state logic
             */
            /*hands*/
            controllerService.getGamepads().forEach(gamepad => {
                if (gamepad.isVRReady()) {
                    let state = gamepad.getControllerState();
                    payload.hands[gamepad.index] = state;
                }
            });

            /*send data*/
            payload.id = this.peerJsService.getMyPeerJsId();
            payload.position = this.r360._cameraPosition;
            payload.rotation = rotateByQuaternion(this.r360._cameraQuat);
            this.peerJsService.broadcastData("player_state", payload);
        }, FPS24);
    }
}