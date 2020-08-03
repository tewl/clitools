import * as path from "path";
import * as _ from "lodash";
import * as BBPromise from "bluebird";
import {Directory} from "./depot/directory";
import { File } from "./depot/file";
import {matchesAny} from "./depot/regexpHelpers";
import {promptToContinue} from "./depot/prompts";
import {Result, successResult, failureResult, isSuccess, isFailure, ISuccessResult} from "./depot/result";
import {FileComparer} from "./depot/diffDirectories";
import {removeAsync, mapAsync} from "./depot/promiseHelpers";


// tslint:disable: max-classes-per-file

enum ConfidenceLevel
{
    HIGH     = 10,
    MEDIUM   =  6,
    LOW      =  3,
    NO_CLUE  =  0
}


////////////////////////////////////////////////////////////////////////////////
// Datestamp Strategies
////////////////////////////////////////////////////////////////////////////////


interface IDatestampDeductionSuccess
{
    readonly confidence:  ConfidenceLevel;
    readonly datestamp:   Datestamp;
    readonly explanation: string;
}


interface IDatestampDeductionFailure
{
    readonly confidence:  ConfidenceLevel.NO_CLUE;
    readonly explanation: string;
}



type DatestampDeduction = IDatestampDeductionFailure | IDatestampDeductionSuccess;

function isSuccesfulDatestampDeduction(deduction: DatestampDeduction): deduction is IDatestampDeductionSuccess
{
    return deduction.confidence !== ConfidenceLevel.NO_CLUE;
}

function isFailureDatestampDeduction(deduction: DatestampDeduction): deduction is IDatestampDeductionFailure
{
    return deduction.confidence === ConfidenceLevel.NO_CLUE;
}

class DatestampDeductionAggregate
{
    // #region Instance Data Members
    private _deductions: Array<DatestampDeduction> = [];
    // #endregion


    public get deductions(): ReadonlyArray<DatestampDeduction>
    {
        return this._deductions;
    }


    public push(deduction: DatestampDeduction): void
    {
        this._deductions.push(deduction);
    }


    public hasSuccessfulDeductions(): boolean
    {
        const hasSuccessfulDeductions = _.some(this._deductions, isSuccesfulDatestampDeduction);
        return hasSuccessfulDeductions;
    }


    public getSuccessfulDeductions(): Array<IDatestampDeductionSuccess>
    {
        const successfulDeductions = _.filter(this._deductions, isSuccesfulDatestampDeduction);
        return successfulDeductions;
    }

    public getFailedDeductionExplanations(): Array<string>
    {
        const explanations = _.chain(this._deductions)
        .filter(isFailureDatestampDeduction)
        .map((curFailedDeduction) => curFailedDeduction.explanation)
        .value();
        return explanations;
    }


    public isConflicted(): boolean
    {
        const successfulDeductions = this.getSuccessfulDeductions();
        if (successfulDeductions.length === 0) {
            throw new Error("isConflicted() called with no successful deductions. Test to see if this aggregate is successful first.");
        }

        const firstDatestamp: Datestamp = successfulDeductions[0].datestamp!;
        const allAreEqual = _.every(successfulDeductions, (curDeduction) => curDeduction.datestamp.equals(firstDatestamp));
        return allAreEqual;
    }

    public getHighestConfidenceDeductions(): Array<IDatestampDeductionSuccess>
    {
        const successfulDeductions = this.getSuccessfulDeductions();
        if (successfulDeductions.length === 0) {
            return [];
        }

        const confidenceGroups = _.groupBy(successfulDeductions, (curDeduction) => curDeduction.confidence);

        const highestConfidenceLevelFound = _.find(
            [ConfidenceLevel.HIGH, ConfidenceLevel.MEDIUM, ConfidenceLevel.LOW],
            (curConfidenceLevel) => {
                const deductions = confidenceGroups[curConfidenceLevel];
                return deductions && deductions.length > 0;
            }
        )!;

        return confidenceGroups[highestConfidenceLevelFound];
    }
}




interface IFileDatestampStrategy
{
    /**
     * A function that attempts to deduce the datestamp associated with the
     * specified file.
     * @param source - The file to analyze.
     * @return A promise that always resolves with a deduction result
     * (indicating success or failure).
     */
    (source: File): Promise<DatestampDeduction>;
}


// TODO: Implement this.
// function FileDatestampStrategyExif(source: File): Promise<DatestampDeduction>
// {
// }


const dateRegex = /(?<date>(?<year>(20|19)\d\d)([-_])?(?<month>[01]\d)([-_])?(?<day>[0123]\d))/;


function FileDatestampStrategyFilePath(source: File): Promise<DatestampDeduction>
{
    const absPath = source.absPath();

    const matchResult = absPath.match(dateRegex);
    if (!matchResult) {
        return BBPromise.resolve({
            confidence: ConfidenceLevel.NO_CLUE,
            explanation: `The file path '${absPath}' does not contain a datestamp.`
        });
    }

    const dateStr  = matchResult.groups!.date;
    const yearStr  = matchResult.groups!.year;
    const monthStr = matchResult.groups!.month;
    const dayStr   = matchResult.groups!.day;

    const datestampResult = Datestamp.fromStrings(yearStr, monthStr, dayStr);
    if (!datestampResult.success) {
        throw new Error(`Failed to instantiate Datestamp: ${datestampResult.message}`);
    }

    return BBPromise.resolve({
        confidence:  ConfidenceLevel.MEDIUM,
        datestamp:   datestampResult.value,
        explanation: `The file path '${absPath}' contains the date '${dateStr}'.`
    });
}


async function ApplyFileDatestampStrategies(
    source: File,
    strategies: Array<IFileDatestampStrategy>
): Promise<DatestampDeductionAggregate>
{
    const allDeductions = await mapAsync(strategies, (curStrategy) => curStrategy(source));

    const aggregateDeduction = new DatestampDeductionAggregate();
    for (const curResult of allDeductions) {
        aggregateDeduction.push(curResult);
    }
    return aggregateDeduction;
}


////////////////////////////////////////////////////////////////////////////////
// Datestamp
////////////////////////////////////////////////////////////////////////////////

class Datestamp
{

    public static fromStrings(yearStr: string, monthStr: string, dayStr: string): Result<Datestamp, void>
    {
        const year  = parseInt(yearStr, 10);
        const month = parseInt(monthStr, 10);
        const day   = parseInt(dayStr, 10);

        if (Number.isNaN(year))
        {
            return failureResult(undefined, `${yearStr} is not a valid year string.`);
        }

        if (Number.isNaN(month))
        {
            return failureResult(undefined, `${monthStr} is not a valid year string.`);
        }

        if (Number.isNaN(day))
        {
            return failureResult(undefined, `${dayStr} is not a valid year string.`);
        }

        //
        // Do some reality checks on the date to make sure it is reasonable.
        //
        const now = new Date();
        const curYear = now.getFullYear();
        if (year < curYear - 100 || year > curYear) {
            return failureResult(undefined, `${year} is not a valid year.`);
        }

        if (month < 1 || month > 12)
        {
            return failureResult(undefined, `${month} is not a valid month.`);
        }

        if (day < 1 || day > 31) {
            return failureResult(undefined, `${day} is not a valid day.`);
        }

        return successResult(new Datestamp(year, month, day));
    }


    // #region Instance Data Members
    private _year: number;
    private _month: number;
    private _day: number;
    // #endregion


    private constructor(year: number, month: number, day: number)
    {
        this._year  = year;
        this._month = month;
        this._day   = day;
    }


    public equals(other: Datestamp): boolean
    {
        return this._year  === other._year &&
               this._month === other._month &&
               this._day   === other._day;
    }
}


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

    console.log(`There are ${unwanted.length} unwanted files.`);
    for (const curUnwanted of unwanted) {
        const keepGoing = await promptToContinue(`Delete ${curUnwanted.toString()}`, true, true);
        if (keepGoing)
        {
            await curUnwanted.delete();
        }
    }

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
    // that file would be found in `destDir`.
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

    // TODO: Keep writing this code until all files in srcDir are accounted for.
    // Some additional ideas for strategies that I may need:
    // - Using EXIF data from photo (high confidence level in resulting date)
    // - Using date in the file's path (already implemented)
    // - Using dates of other files in the same folder.
    //    - Especially useful for video files.

    // TODO: Do an additional copy of files from chandra, because I think I may
    // have accidentally deleted a few in \\floyd\chandratmp.

    return 0;
}
