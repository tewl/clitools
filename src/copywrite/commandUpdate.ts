import {Argv, Arguments} from "yargs";
import {Directory} from "../depot/directory";
import {FilePair} from "./filePair";
import table from "text-table";
import {promptToContinue} from "../depot/prompts";
import {getFileMap} from "./fileMap";


export const command = "update <sourceDir> <destDir>";
export const describe = "Update the files in destDir with the version from sourceDir";
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

export function handler(args: Arguments): void {

    // Get file maps for both the source and destination directories.
    const sourceDir: Directory = new Directory(args.sourceDir);
    const sourceMapPromise = getFileMap(sourceDir);

    const destDir: Directory = new Directory(args.destDir);
    const destMapPromise = getFileMap(destDir);

    Promise.all([sourceMapPromise, destMapPromise])
    .then(([srcMap, dstMap]) => {

        // Take all of the file names found in the destination directory, and
        // transform it into an array of file pairs when there is a source file
        // with the same name.
        let filePairs: Array<FilePair> = Array.from(dstMap.keys()).reduce<Array<FilePair>>(
            (acc, curDstFileName) => {
                // If the current destination file is also a source file, create
                // a file pair.
                if (srcMap.has(curDstFileName)) {
                    const filePair = new FilePair(srcMap.get(curDstFileName)!, dstMap.get(curDstFileName)!);
                    acc.push(filePair);
                }
                return acc;
            },
            []
        );

        // For each file pair, find out if the source and destination files
        // are identical.
        const areIdenticalPromises = filePairs.map(
            (curFilePair) => curFilePair.filesAreIdentical()
        );

        return Promise.all(areIdenticalPromises)
        .then((areIdenticalResults) => {
            // Filter the array of file pairs to include only the ones
            // where the source and destination files are not identical.
            filePairs = filePairs.filter((curFilePair, index) => !areIdenticalResults[index]);

            return filePairs;
        });
    })
    .then((filePairs) => {
        // Print a preview of the operations that are about to happen.
        console.log("");
        if (filePairs.length === 0) {
            console.log("No files need to be updated.");
            return filePairs;
        }
        else {
            // Create tuples where the first value is the source file and the
            // second value is the destination file.
            const rows = filePairs.map(
                (curFilePair) => [curFilePair.fileA.toString(), curFilePair.fileB.toString()]
            );
            const previewTable = table(rows, {hsep: " ==> "});
            console.log(previewTable);
            return promptToContinue(
                `Proceed with copying ${filePairs.length} files?`,
                true
            )
            .then((shouldContinue) => {
                return shouldContinue ? filePairs : Promise.reject("Aborted by user.");
            });
        }
    })
    .then((filePairs) => {
        const copyPromises = filePairs.map((curFilePair) => curFilePair.copyAToB());
        return Promise.all(copyPromises);
    })
    .then((dstFiles) => {
        console.log(`Copied ${dstFiles.length} files.`);
    });
}
