import * as os from "os";
import { compareIntrinsic } from "./depot/compare";
import { dateRange, dayOfWeek } from "./depot/dateHelpers";
import { File } from "./depot/file";
import { FailedResult, Result, SucceededResult } from "./depot/result";


const dateHeadlineRegex = /^\*\s+(?<month>\d{1,2})\/(?<day>\d{1,2})\/(?<year>\d{4})\s+\w+$/gm;
const numYearsIntoFuture = 5;


/**
 * Locates and performs maintenance on the 43 folders Org file.
 *
 * @returns A successful Result containing the 43 folders Org file, or a failure
 * result containing an error message.
 */
export async function getFortyThreeFoldersFile(): Promise<Result<File, string>> {
    const cloudHome = process.env.CLOUDHOME;
    if (!cloudHome) {
        return new FailedResult(`CLOUDHOME environment variable is not set.`);
    }

    const fortyThreeFoldersFile = new File(cloudHome, "data", "43_folders", "43_folders.org");

    const maxDatePresent = await getMaxDate(fortyThreeFoldersFile);
    const now = new Date();
    const startDate = new Date(maxDatePresent.getFullYear(), maxDatePresent.getMonth(), maxDatePresent.getDate() + 1);
    const endDate = new Date(now.getFullYear() + numYearsIntoFuture, now.getMonth(), now.getDate());

    const datesToAdd = Array.from(dateRange(startDate, endDate));
    console.log(`Adding ${datesToAdd.length} dates to 43 folders file...`);

    // We need to add the dates sequentially.  If this is done in parallel, they
    // can be added to the file out of order.
    for (const curDate of datesToAdd) {
        const res = await appendDateHeadline(fortyThreeFoldersFile, curDate);
        if (res.failed) {
            const msg = `Failed to append date to 43 folders file.`;
            console.error(msg);
            return new FailedResult(msg);
        }
    }

    return new SucceededResult(fortyThreeFoldersFile);
}


/**
 * Finds the maximum Date represented in the given Org file.
 *
 * @param file - The input file
 * @returns The maximum Date represented in the specified Org file
 */
async function getMaxDate(file: File): Promise<Date> {

    const datesPresent: Array<Date> = [];

    await file.readLines((text) => {
        const match = dateHeadlineRegex.exec(text);
        if (match) {
            const monthIndex = parseInt(match.groups!.month, 10) - 1;
            const day = parseInt(match.groups!.day, 10);
            const year = parseInt(match.groups!.year, 10);
            datesPresent.push(new Date(year, monthIndex, day));
        }
    });

    datesPresent.sort(compareIntrinsic);
    const lastDatePresent = datesPresent.at(-1)!;
    return lastDatePresent;
}


/**
 * Appends an Org file headline for the given date to the given file.
 *
 * @param file - The file to be appended to
 * @param date - The date for which an Org file headline will be added
 * @returns A successful result containing the file or a failure result
 * containing an error message
 */
function appendDateHeadline(file: File, date: Date): Promise<Result<File, string>> {
    const headline = getHeadline(date) + os.EOL;
    return file.append(headline, true);
}


/**
 * Gets the Org file headline for a given Date.
 *
 * @param date - The input Date
 * @returns The Org file headline for the given Date
 */
function getHeadline(date: Date): string {
    const headline = `* ${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()} ${dayOfWeek(date)}`;
    return headline;
}
