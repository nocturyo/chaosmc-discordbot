import type { Command } from '../types/Command';

import ban from './ban';
import cleanwarn from './cleanwarn';
import mcstatus from './mcstatus';
import ping from './ping';
import setboostchannel from './setboostchannel';
import setlogchannel from './setlogchannel';
import timeout from './timeout';
import unban from './unban';
import userinfo from './userinfo';
import warn from './warn';

export const commands: Command[] = [
  ping,
  mcstatus,
  setlogchannel,
  setboostchannel,
  warn,
  cleanwarn,
  timeout,
  ban,
  unban,
  userinfo,
];

export default commands;
