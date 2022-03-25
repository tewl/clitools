////////////////////////////////////////////////////////////////////////////////
//
// Usage: node.exe findgrep.js
//
// It is recommended that you use the %USERPROFILE% environment variable to
// specify an output directory within your user directory.
//
// Example:
// node.exe %USERPROFILE%\dev\path\to\windowsSpotlightImages.js %USERPROFILE%\blah\blah\Windows_Spotlight
//
// Note:  If this script is run using Windows Task Scheduler, that task will
// have to be updated whenever your password changes.
//
////////////////////////////////////////////////////////////////////////////////

// import chalk = require("chalk");
import * as yargs from "yargs";
import { Directory } from "./depot/directory";
import { failed, failedResult, Result, succeededResult } from "./depot/result";


// const fileStyle = chalk.green.bold;
// const hitStyle  = chalk.inverse;


if (require.main === module)
{
    findGrepMain()
    .then((exitCode) =>
    {
        if (exitCode !== 0)
        {
            process.exit(exitCode);
        }
    })
    .catch((err: Error) =>
    {
        console.error(err.message);
        process.exit(-1);
    });
}


async function findGrepMain(): Promise<number>
{
    const configResult = getConfiguration();
    if (failed(configResult))
    {
        throw new Error(configResult.error);
    }

    console.log(`path regex: ${configResult.value.pathRegex}`);
    console.log(`text regex: ${configResult.value.textRegex}`);
    console.log(`recurse:    ${configResult.value.recurse}`);
    console.log();

    const cwd = new Directory(".");
    await cwd.walk((fileOrDir) =>
    {
        console.log(fileOrDir.toString());

        const recurseIntoDir = configResult.value.recurse;
        return recurseIntoDir;
    });

    return 0;
}


/**
 * Configuration options for this script.
 */
interface IFindGrepConfig
{
    recurse: boolean;
    pathRegex: string;
    textRegex: string;
}


/**
 * Parses the command line and gathers the options into an easily consumable
 * form.
 * @return The configuration parameters for this script
 */
function getConfiguration(): Result<IFindGrepConfig, string>
{
    const argv = yargs
    .usage("Finds text within files.")
    .help()
    .option(
        "recurse",
        {
            demandOption: false,
            type:         "boolean",
            default:      false,
            describe:     "search through subdirectories recursively."
        }
    )
    .wrap(80)
    .argv;

    //
    // Get the command from the command line arguments.
    //
    const pathRegex = argv._[0];
    if (!pathRegex)
    {
        return failedResult(`Path regex not specified.`);
    }
    const textRegex = argv._[1];
    if (!textRegex)
    {
        return failedResult(`Text regex not specified.`);
    }

    return succeededResult({
        recurse:   argv.recurse,
        pathRegex: pathRegex,
        textRegex: textRegex
    });
}
