/* eslint-disable @typescript-eslint/no-unused-expressions */

import * as yargs from "yargs";
import * as commandUpdate from "./copywrite/commandUpdate";
import * as commandFull from "./copywrite/commandFull";
import * as commandDiff from "./copywrite/commandDiff";


// Each command is implemented in its own module.
yargs
.command(commandUpdate)
.command(commandFull)
.command(commandDiff)
.help().argv;
