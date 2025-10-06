import ping from './ping';
import setlogchannel from './setlogchannel';
import warn from './warn';
import type { Command } from '../types/Command';

export const commands: Command[] = [ping, setlogchannel, warn];
