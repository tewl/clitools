////////////////////////////////////////////////////////////////////////////////
//
// Usage: node.exe findgrep.js
//
// Running this script using ts-node:
// .\node_modules\.bin\ts-node .\src\findgrep.ts --recurse --pathIgnore "node_modules" --pathIgnore "package-lock" "/\.json$/i" "/depend/i"
//
////////////////////////////////////////////////////////////////////////////////

import * as os from "os";
import chalk = require("chalk");
import * as yargs from "yargs";
import { toArray } from "./depot/arrayHelpers";
import { highlightMatches } from "./depot/chalkHelpers";
import { Directory } from "./depot/directory";
import { matchesAny, strToRegExp } from "./depot/regexpHelpers";
import { failed, Result, succeededResult } from "./depot/result";
import { bindResult, boolToResult, mapWhileSuccessful } from "./depot/resultHelpers";
import _ = require("lodash");
import { pipe } from "./depot/pipe";


const fileStyle = chalk.cyan;
const fileMatchStyle = fileStyle.inverse;
const lineStyle = chalk.yellow;
const textMatchStyle  = chalk.inverse;


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
    console.log(`path ignores: ${configResult.value.pathIgnores.join(", ")}`);
    console.log(`text regex: ${configResult.value.textRegex}`);
    console.log(`recurse:    ${configResult.value.recurse}`);
    console.log();

    const pathRegex = configResult.value.pathRegex;
    const textRegex = configResult.value.textRegex;

    const cwd = new Directory(".");
    await cwd.walk(async (fileOrDir): Promise<boolean> =>
    {
        if (fileOrDir instanceof Directory)
        {
            // As a performance optimization, if the directory matches any of
            // the pathIgnore patterns, do not recurse into it.  Otherwise,
            // recurse into it as the user has specified.
            return matchesAny(fileOrDir.toString(), configResult.value.pathIgnores) ?
                false :
                configResult.value.recurse;
        }

        // See if the file's path matches the path regular expression.  If not,
        // we are done.
        const [numPathMatches, highlightedPath] = highlightMatches(fileOrDir.toString(), pathRegex, fileMatchStyle);
        if (numPathMatches === 0)
        {
            return false; // Return value does not matter when processing files.
        }

        // If the file's path should be ignored, we are done.
        if (matchesAny(fileOrDir.toString(), configResult.value.pathIgnores))
        {
            return false; // Return value does not matter when processing files.
        }

        const fileText = fileStyle(highlightedPath);
        let fileProducedOutput = false;

        // Read the file line by line and output lines that match the text
        // regular expression.

        await fileOrDir.readLines((lineText, lineNum) =>
        {
            const [numMatches, highlightedText] = highlightMatches(lineText, textRegex, textMatchStyle);
            if (numMatches > 0)
            {
                const lineNumText = lineStyle(`:${lineNum}`);
                console.log(fileText + lineNumText + " - " + highlightedText);
                fileProducedOutput = true;
            }
        });

        if (fileProducedOutput)
        {
            // The current file produced output.  Leave a blank line at the of
            // its output.
            console.log();
        }

        return false; // Return value does not matter when processing files.
    });

    return 0;
}


/**
 * Configuration options for this script.
 */
interface IFindGrepConfig
{
    recurse: boolean;
    pathRegex: RegExp;
    textRegex: RegExp;
    pathIgnores: Array<RegExp>;
}


/**
 * Parses the command line and gathers the options into an easily consumable
 * form.
 * @return The configuration parameters for this script
 */
function getConfiguration(): Result<IFindGrepConfig, string>
{
    const argv = yargs
    .usage(
        [
            "Finds text within files.",
            `findgrep [options] "<pathRegex>" "<textRegex>"`
        ].join(os.EOL)
    )
    .help()
    .option(
        "recurse",
        {
            demandOption: false,
            type:         "boolean",
            default:      false,
            describe:     "search through subdirectories recursively"
        }
    )
    .option(
        "pathIgnore",
        {
            demandOption: false,
            describe:     "Ignore paths that match the specified regex"
        }
    )
    .wrap(80)
    .argv;

    // Get the path regex positional argument.
    const pathRegexResult = pipe(
        succeededResult(argv._[0]),
        (r) => bindResult((v) => boolToResult(_.isString(v), v, "Path regex not specified."), r),
        (r) => bindResult(strToRegExp, r)
    );
    if (failed(pathRegexResult))
    {
        return pathRegexResult;
    }

    // Get the text regex positional argument.
    const textRegexResult = pipe(
        succeededResult(argv._[1]),
        (r) => bindResult((v) => boolToResult(_.isString(v), v, "Text regex not specified."), r),
        (r) => bindResult(strToRegExp, r)
    );
    if (failed(textRegexResult))
    {
        return textRegexResult;
    }

    // Get the path ignore regexes from the --pathIgnore arguments.
    const pathIgnoresResult = pipe(
        succeededResult(toArray<string>(argv.pathIgnore)),
        (r) => bindResult((v) => mapWhileSuccessful(v, strToRegExp), r)
    );
    if (failed(pathIgnoresResult))
    {
        return pathIgnoresResult;
    }

    return succeededResult({
        recurse:     argv.recurse,
        pathRegex:   pathRegexResult.value,
        pathIgnores: pathIgnoresResult.value,
        textRegex:   textRegexResult.value
    });
}
