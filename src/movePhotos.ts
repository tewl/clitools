import * as _ from "lodash";
import * as BBPromise from "bluebird";
import {Directory} from "./depot/directory";
import { File } from "./depot/file";
import {matchesAny} from "./depot/regexpHelpers";
import {promptToContinue} from "./depot/prompts";
import {Result, successResult, failureResult} from "./depot/result";


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


    public constructor()
    {
    }


    public get deductions(): ReadonlyArray<DatestampDeduction>
    {
        return this._deductions;
    }


    public push(deduction: DatestampDeduction): void
    {
        this._deductions.push(deduction);
    }


    public getSuccessfulDeductions(): Array<IDatestampDeductionSuccess>
    {
        const successfulDeductions = _.reduce<DatestampDeduction, Array<IDatestampDeductionSuccess>>(
            this._deductions,
            (acc, curDeduction) =>
            {
                if (isSuccesfulDatestampDeduction(curDeduction))
                {
                    acc.push(curDeduction);
                }
                return acc;
            },
            []
        );
        return successfulDeductions;
    }

    public getFailedDeductionExplanations(): Array<string>
    {
        const failedDeductions = _.reduce<DatestampDeduction, Array<IDatestampDeductionFailure>>(
            this._deductions,
            (acc, curDeduction) =>
            {
                if (isFailureDatestampDeduction(curDeduction))
                {
                    acc.push(curDeduction);
                }
                return acc;
            },
            []
        );

        return _.map(failedDeductions, (curFailedDeduction) => curFailedDeduction.explanation);
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


async function ApplyFileDatestampStrategies(source: File, strategies: Array<IFileDatestampStrategy>): Promise<DatestampDeductionAggregate>
{
    const promises = _.map(strategies, (curStrategy) => curStrategy(source));
    const allResults = await BBPromise.all(promises);

    const aggregateDeduction = new DatestampDeductionAggregate();
    for (const curResult of allResults) {
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

    const contents = await srcDir.contents(true);

    //
    // Delete unwanted source files.
    //
    console.log("Searching for unwanted files...");
    const unwanted = _.remove(
        contents.files,
        (curSrcFile) => matchesAny(curSrcFile.toString(), [/Thumbs\.db$/i, /\.DS_Store$/i])
    );

    console.log(`There are ${unwanted.length} unwanted files.`);
    for (const curUnwanted of unwanted) {
        const keepGoing = await promptToContinue(`Delete ${curUnwanted.toString()}`, true, true);
    }

    // TODO: Delete source files that are exactly the same in the destination.

    // LEFT OFF HERE:
    // I need to create strategy objects that accept a file and return a date along with a confidence level:
    // - Using EXIF data from the photo
    // - Using a date in the file's path
    //   - Do reality checks. For example, month cannot be > 12.
    //   - DS File uses the format IMG_20181110_142609
    // - Using dates from other files in the same folder.
    //   - Especially useful for video files.

    return 0;
}
