////////////////////////////////////////////////////////////////////////////////
//
// A script that opens Windows Explorer with a random file selected
// Usage: node .\dist\src\randomFile.js
//
////////////////////////////////////////////////////////////////////////////////

import yargs from "yargs";
import { Directory } from "./depot/directory";
import { getOs, OperatingSystem } from "./depot/os";
import { getRandomInt } from "./depot/random";
import { spawn } from "./depot/spawn2";


if (require.main === module) {
    main()
    .then((exitCode) => {
        if (exitCode !== 0) {
            process.exit(exitCode);
        }
    })
    .catch((err: Error) => {
        console.error(err.message);
        process.exit(-1);
    });
}


interface IConfig {
    open: boolean;
    show: boolean;
}


function getConfiguration(): IConfig {
    const argv = yargs
    .usage("Selects a random file from within the current working directory.")
    .help()
    .option(
        "open",
        {
            demandOption: false,
            type:         "boolean",
            default:      false,
            describe:     "open the randomly selected file"
        }
    )
    .option(
        "show",
        {
            demandOption: false,
            type:         "boolean",
            default:      false,
            describe:     "show the file"
        }
    )
    .wrap(80)
    .argv;

    return {
        open: argv.open,
        show: argv.show
    };
}

async function main(): Promise<number> {
    const cwd = new Directory(".");
    const os = getOs();
    const { files } = await cwd.contents(true);
    const randomInt = getRandomInt(0, files.length);
    const randomFile = files[randomInt];
    const randomFileQuoted = `"${randomFile.toString()}"`;
    const config = getConfiguration();

    console.log(`Files:      ${files.length}`);
    console.log(`Random Int: ${randomInt}`);
    console.log(`Selected:   ${randomFileQuoted}`);

    if (os === OperatingSystem.Windows) {

        if (config.show) {
            // TODO: Create a show() method on File.
            spawn("explorer.exe", ["/select,", randomFile.absPath()]);
        }

        if (config.open) {
            // TODO: Create a open() method on File.
            // TODO: Create a open() method on Directory.
            spawn("start", [`""`, randomFileQuoted], {shell: true, cwd: cwd.toString()});
        }

    }

    return Promise.resolve(0);
}
