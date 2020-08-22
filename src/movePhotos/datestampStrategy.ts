import * as BBPromise from "bluebird";
import { File } from "../depot/file";
import { Directory } from "../depot/directory";
import { mapAsync } from "../depot/promiseHelpers";
import { Datestamp } from "./datestamp";
import { ConfidenceLevel, DatestampDeduction} from "./datestampDeduction";
import { DatestampDeductionAggregate } from "./datestampDeductionAggregate";


interface IDatestampStrategy
{
    /**
     * A function that attempts to deduce the datestamp associated with the
     * specified file.
     * @param source - The file to analyze.
     * @return A promise that always resolves with a deduction result
     * (indicating success or failure).
     */
    (source: File, destDir: Directory): Promise<DatestampDeduction>;
}


// TODO: Implement an _exif_ strategy.


const dateRegex = /\/(?<date>(?<year>(20|19)\d\d)([-_])?(?<month>[01]\d)([-_])?(?<day>[0123]\d))/;
const datedFolderRegex = /[/\\](?<date>(?<year>(20|19)\d\d)([-_])?(?<month>[01]\d)([-_])?(?<day>[0123]\d))(?<desc>.*?)?[/\\]/;


export function datestampStrategyFilePath(source: File, destDir: Directory): Promise<DatestampDeduction>
{
    const absPath = source.absPath();

    const matchResult = absPath.match(dateRegex);
    if (!matchResult)
    {
        return BBPromise.resolve({
            confidence: ConfidenceLevel.NO_CLUE,
            explanation: `The file path '${absPath}' does not contain a datestamp.`
        });
    }

    const dateStr = matchResult.groups!.date;
    const yearStr = matchResult.groups!.year;
    const monthStr = matchResult.groups!.month;
    const dayStr = matchResult.groups!.day;

    const datestampResult = Datestamp.fromStrings(yearStr, monthStr, dayStr);
    if (!datestampResult.success)
    {
        throw new Error(`Failed to instantiate Datestamp: ${datestampResult.message}`);
    }

    const datestamp = datestampResult.value;

    return BBPromise.resolve({
        confidence: ConfidenceLevel.MEDIUM,
        datestamp: datestampResult.value,
        explanation: `The file path '${absPath}' contains the date '${dateStr}'.`,
        destFile: new File(destDir, datestamp.year.toString(),)
    });
}


export async function applyDatestampStrategies(
    source: File,
    destDir: Directory,
    strategies: Array<IDatestampStrategy>
): Promise<DatestampDeductionAggregate>
{
    const allDeductions = await mapAsync(strategies, (curStrategy) => curStrategy(source, destDir));

    const aggregateDeduction = new DatestampDeductionAggregate();
    for (const curResult of allDeductions)
    {
        aggregateDeduction.push(curResult);
    }
    return aggregateDeduction;
}
