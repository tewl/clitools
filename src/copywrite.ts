/* eslint-disable @typescript-eslint/no-unused-expressions */

import * as yargs from "yargs";
import * as commandUpdate from "./copywrite/commandUpdate";
import * as commandFull from "./copywrite/commandFull";


// Each command is implemented in its own module.
yargs
.command(commandUpdate)
.command(commandFull)
.help().argv;
