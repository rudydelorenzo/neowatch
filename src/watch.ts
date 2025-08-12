/* takes in a schedule, a function, and callback
    the schedule is a cron-formatted string
    the fn is the function whose return we will watch, must return list
    the callback will take as arguments the changes to the return from fn

    perhaps we can pass in an optional comparator function eventually
 */

import { isDeepStrictEqual } from "node:util";
import { Cron } from "croner";
import { createLogger, format, transports } from "winston";

import type { LogLevelsType } from "./types.ts";

type Comparator<T> = (a: T, b: T) => boolean;

type WatchOptions<T> = {
    comparator?: Comparator<T>;
    dithering?: number; // milliseconds on either end, max is (interval between runs / 2)
    logLevel?: LogLevelsType;
    pushChangesOnFirstRun?: boolean; // if callback should be called with full list of data on first call
    ignoreFailures?: boolean;
};

const objInList = <T>(
    o: T,
    list: T[],
    comparator: Comparator<T> = isDeepStrictEqual,
): boolean => {
    for (const test of list) {
        if (comparator(o, test)) {
            return true;
        }
    }
    return false;
};

const getNewData = <T>(
    prev: T[],
    latest: T[],
    comparator?: Comparator<T>,
): T[] => {
    // return list of items in latest that do not exist in prev
    // this function is O(n*m) where n and m are lengths of prev and latest
    const newData: T[] = [];

    for (const datapoint of latest) {
        if (!objInList(datapoint, prev, comparator)) {
            newData.push(datapoint);
        }
    }

    return newData;
};

const getNextRunTiming = (
    schedule: string,
    currentRunSlot: Date,
    maxDither: number = 0,
): { nextRunSlot: Date; timeoutMs: number } | undefined => {
    // bootstrap next run
    const nextRunSlot = new Cron(schedule, {
        startAt: currentRunSlot,
    }).nextRun();

    if (!nextRunSlot) return;

    const msBetweenSlots = nextRunSlot.getTime() - currentRunSlot.getTime();

    // bounded max dither to be half of the time between slots (if 1m between slots, max dith is +/-30s)
    const realMaxDither = Math.min(maxDither, msBetweenSlots / 2);

    // milliseconds to deviate from designated slot time
    const dither = realMaxDither - Math.random() * (realMaxDither * 2);

    const msLeftTillNextSlot = nextRunSlot.getTime() - new Date().getTime();

    const ditheredMsTillNextRun = msLeftTillNextSlot + dither;

    const boundedMsTillNextRun = Math.min(
        Math.max(0, ditheredMsTillNextRun),
        nextRunSlot.getTime() + msBetweenSlots,
    );

    return { nextRunSlot, timeoutMs: boundedMsTillNextRun };
};

export const watch = async <T extends unknown>(
    schedule: string,
    fn: () => T[] | Promise<T[]>,
    callback: (changes: T[]) => any,
    options?: WatchOptions<T>,
): Promise<void> => {
    const alignedWithColorsAndTime = format.combine(
        format.colorize(),
        format.timestamp(),
        format.align(),
        format.printf(
            (info) => `${info.timestamp} ${info.level}: ${info.message}`,
        ),
    );

    const logger = createLogger({
        level: options?.logLevel || "error",
        format: alignedWithColorsAndTime,
        transports: [new transports.Console()],
    });

    const run = async (prev: T[], slot: Date) => {
        logger.debug(`### RUN @ ${new Date().toISOString()} ###`);

        // fetch new data
        let newData: T[] = prev;
        try {
            newData = await fn();
        } catch (e) {
            if (!options?.ignoreFailures) {
                throw e; // rethrow
            }
        }

        // compare
        const changes = getNewData(prev, newData, options?.comparator);

        // callback
        if (changes.length !== 0) {
            callback(changes);
        } else {
            logger.debug("NO CHANGES, SKIPPED CALLBACK");
        }

        // bootstrap next run
        const nextRunTiming = getNextRunTiming(
            schedule,
            slot,
            options?.dithering,
        );

        if (!nextRunTiming) return;

        logger.debug(JSON.stringify(nextRunTiming));
        logger.debug(
            `nextRunTime: ${new Date(Date.now() + nextRunTiming?.timeoutMs).toISOString()}`,
        );

        setTimeout(
            () => run(newData, nextRunTiming.nextRunSlot),
            nextRunTiming.timeoutMs,
        );

        logger.debug(`### ENDED RUN @ ${new Date().toISOString()} ###`);
    };

    await run(options?.pushChangesOnFirstRun ? [] : await fn(), new Date());
};
