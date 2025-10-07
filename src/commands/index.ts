import ping from './ping';
import setlogchannel from './setlogchannel';
import warn from './warn';
import type { Command } from '../types/Command';
import cleanwarn from './cleanwarn';
import ban from './ban';
import unban from './unban';
import timeout from './timeout';
import userinfo from './userinfo';
import mcstatus from './mcstatus';

export const commands: Command[] = [ping, setlogchannel, warn, cleanwarn, ban, unban, timeout, userinfo, mcstatus

];
