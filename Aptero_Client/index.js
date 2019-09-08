import {
    AppRegistry,
} from 'react-360';
import Hello360 from "./src/react/Hello360"
import Room from "./src/objects/Room";
import Menu360 from "./src/react/Menu360";
import ParticipantHead from "./src/objects/ParticipantHead";
import Env from "./src/objects/Env";
import ParticipantHand from "./src/objects/ParticipantHand";

AppRegistry.registerComponent('Hello360', () => Hello360);
AppRegistry.registerComponent('Menu360', () => Menu360);
AppRegistry.registerComponent('Room', () => Room);
AppRegistry.registerComponent('ParticipantHead', () => ParticipantHead);
AppRegistry.registerComponent('ParticipantHand', () => ParticipantHand);

AppRegistry.registerComponent('Env', () => Env);
