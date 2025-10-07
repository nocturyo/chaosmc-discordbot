import ping from './ping';
import setlogchannel from './setlogchannel';
import warn from './warn';
import type { Command } from '../types/Command';
import cleanwarn from './cleanwarn';
import ban from './ban';
import unban from './unban';

export const commands: Command[] = [ping, setlogchannel, warn, cleanwarn, ban, unban

];
