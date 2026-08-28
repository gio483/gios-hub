import { livingRoom } from './living-room.js';
import { kitchen } from './kitchen.js';
import { bathroom } from './bathroom.js';
import { greatRoom } from './great-room.js';
import { blueHour } from './blue-hour.js';
import { hallway } from './hallway.js';
import { darkOffice } from './dark-office.js';

export const SCENES = [livingRoom, kitchen, bathroom, greatRoom, blueHour, hallway, darkOffice];
export const sceneById = (id) => SCENES.find((s) => s.id === id) || SCENES[0];
