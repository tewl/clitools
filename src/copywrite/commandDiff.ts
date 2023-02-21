import {Argv, Arguments} from "yargs";
import {Directory} from "../depot/directory";
import {FilePair} from "./filePair";
import table from "text-table";
import {promptForChoice, promptToContinue} from "../depot/prompts";
import {getFileMap} from "./fileMap";
import { showVsCodeDiff } from "../depot/fileDiff";


export const command = "diff <sourceDir> <destDir>";
export const describe = "Diff the files in sourceDir and destDir";
export function builder(argv: Argv): Argv {
    return argv
    .positional("sourceDir", {
        describe: "The source directory",
        type:     "string"
    })
    .positional("destDir", {
        describe: "The destination directory",
        type:     "string"
    })
    .check(
        (argv: Arguments) => {
            const sourceDir = new Directory(argv.sourceDir);
            const destDir = new Directory(argv.destDir);

            if (!sourceDir.existsSync()) {
                throw new Error(`The source directory "${sourceDir.toString()}" does not exist.`);
            }

            if (!destDir.existsSync()) {
                throw new Error(`The destination directory "${destDir.toString()}" does not exist.`);
            }

            // If we got this far, everything is valid.
            return true;
        },
        false
    );
}

export async function handler(args: Arguments): Promise<void> {

    // Get file maps for both the source and destination directories.
    const [srcMap, dstMap] = await Promise.all([
        getFileMap(new Directory(args.sourceDir)),
        getFileMap(new Directory(args.destDir))
    ]);

    // Take all of the file names found in the destination directory, and
    // transform it into an array of file pairs when there is a source file with
    // the same name.
    const filePairs = Array.from(dstMap.keys()).reduce<Array<FilePair>>(
        (acc, curDstFileName) => {
            // If the current destination file is also a source file, create a
            // filePair.
            if (srcMap.has(curDstFileName)) {
                const filePair = new FilePair(srcMap.get(curDstFileName)!, dstMap.get(curDstFileName)!);
                acc.push(filePair);
            }
            return acc;
        },
        []
    );

    // If no file pairs were found, we are done.
    if (filePairs.length === 0) {
        console.log(`No similarly named files found.`);
        return undefined;
    }

    // Iterate over the file pairs and let the user interactively choose what to
    // do.
    for (const curFilePair of filePairs) {

        // If the files are identical, just print a message and move to the next.
        if (await curFilePair.filesAreIdentical()) {
            console.log(`File ${curFilePair.fileB.fileName} is identical.`);
        }

        let done = false;
        while (!done) {

            const value = await promptForChoice(
                `File: ${curFilePair.fileB.fileName}`,
                [
                    {name: "diff", value: "diff"},
                    {name: "next", value: "next"},
                    {name: "end", value: "end"}
                ]
            );

            if (value === "diff") {
                await showVsCodeDiff(curFilePair.fileA, curFilePair.fileB, false, true);
                console.log("It returned");
            }
            else if (value === "next") {
                done = true;
            }
            else if (value === "end") {
                return undefined;
            }
        }


    }
}
