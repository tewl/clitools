import * as path from "path";
import * as _ from "lodash";
import {Directory} from "../depot/directory";
import { File } from "../depot/file";
import {matchesAny} from "../depot/regexpHelpers";
import {promptToContinue} from "../depot/prompts";
import {FileComparer} from "../depot/diffDirectories";
import {removeAsync, mapAsync, zipWithAsyncValues} from "../depot/promiseHelpers";
import { datestampStrategyFilePath, applyDatestampStrategies } from "./datestampStrategy";
import {ConfidenceLevel} from "./datestampDeduction";


////////////////////////////////////////////////////////////////////////////////
// Bootstrap
////////////////////////////////////////////////////////////////////////////////

if (require.main === module)
{
    movePhotosMain()
        .then((exitCode) =>
        {
            if (exitCode !== 0)
            {
                process.exit(exitCode);
            }
        });
}


async function movePhotosMain(): Promise<number>
{
    const srcDir = new Directory("\\\\floyd\\chandratmp");
    const destDir = new Directory("\\\\floyd\\photo");
    console.log(`srcDir: ${srcDir}\ndestDir: ${destDir}`);

    console.log(`Finding all files in ${srcDir.toString()}...`);
    const srcFiles = (await srcDir.contents(true)).files;
    console.log(`Source files found: ${srcFiles.length}`);

    //
    // Delete unwanted source files.
    //
    console.log("Searching for unwanted files...");
    const unwanted = _.remove(
        srcFiles,
        (curSrcFile) => matchesAny(curSrcFile.toString(), [/Thumbs\.db$/i, /\.DS_Store$/i])
    );

    console.log(`Unwanted files: ${unwanted.length}`);
    if (unwanted.length > 0) {
        _.forEach(unwanted, (curUnwanted) => console.log(`  ${curUnwanted.toString()}`));
        await promptToContinue(`Delete ${unwanted.length} unwanted files?`, true, true)
        .then(() =>
        {
            return mapAsync(unwanted, async (curUnwanted) => curUnwanted.delete());
        })
        .catch(() => { });
    }

    ////////////////////////////////////////////////////////////////////////////////
    const strategies = [datestampStrategyFilePath];

    const srcAndDeductionAggregates = await zipWithAsyncValues(srcFiles, async (curSrcFile) => {
        return applyDatestampStrategies(curSrcFile, destDir, strategies);
    });

    const highConfidence = _.remove(srcAndDeductionAggregates, (curSrcAndDeductionAggregate) => {
        const highestConfidenceDeductions = curSrcAndDeductionAggregate[1].getHighestConfidenceDeductions();
        return highestConfidenceDeductions.length > 0 &&
               !curSrcAndDeductionAggregate[1].isConflicted() &&
               highestConfidenceDeductions[0].confidence >= ConfidenceLevel.MEDIUM;
    });

    console.log(`There are ${highConfidence.length} high confidence files.`);
    console.log(`There are ${srcAndDeductionAggregates.length} files still unaccounted for.`);
    process.exit(-1);

    ////////////////////////////////////////////////////////////////////////////////

    const fileComparers = _.map(srcFiles, (curSrcFile) => {
        return FileComparer.create(curSrcFile, new File(destDir, path.relative(srcDir.toString(), curSrcFile.toString())));
    });

    //
    // Delete source files that are exactly the same in the destination.
    //

    // LEFT OFF HERE: The following code that attempts to remove identical files
    // is having no effect, because the files' path is not the same in the
    // source and destination.  These paths are set above when the FileComparers
    // are instantiated.  What I need is a function that takes a file and an
    // array of IFileDatestampStrategy objects and gives back the path where
    // that file would be found in _destDir_.
    const identicals = await removeAsync(fileComparers, (fc) => fc.bothExistAndIdentical());
    console.log(`There are ${identicals.length} identical files.`);
    for (const curIdentical of identicals) {
        const doDeletion = await promptToContinue(`${curIdentical.leftFile.toString()} is identical.  Delete?`, true, true);
        if (doDeletion) {
            // TODO: Uncomment this code when we're sure it works.
            // await curIdentical.leftFile.delete();
            console.log("Fake deletion here.");
        }
    }

    // TODO: Keep writing this code until all files in _srcDir_ are accounted for.
    // Some additional ideas for strategies that I may need:
    // - Using EXIF data from photo (high confidence level in resulting date)
    // - Using date in the file's path (already implemented)
    // - Using dates of other files in the same folder.
    //    - Especially useful for video files.

    // TODO: Do an additional copy of files from _chandra_, because I think I may
    // have accidentally deleted a few in _\\floyd\chandratmp_.

    return 0;
}
