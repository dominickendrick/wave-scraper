import {Command, flags} from '@oclif/command'
import { getDate, parseDate } from './utils'
import { addDays } from 'date-fns'
import { getDayData, SessionTypeUrl, HEADLESS, DayData, Slot, SessionType } from './scraper';
import * as puppeteer from 'puppeteer'
import * as fs from 'fs'

interface PromiseFulfilledResult<T> {
  status: "fulfilled";
  value: T;
}

interface PromiseRejectedResult {
  status: "rejected";
  reason: any;
}

type PromiseSettledResult<T> = PromiseFulfilledResult<T> | PromiseRejectedResult;

type CalendarData = {
  classNames: string,
  date: string,
  sessionType: SessionType
}

class WaveScraper extends Command {
  static description = 'describe the command here'

  static flags = {
    // add --version flag to show CLI version
    version: flags.version({char: 'v'}),
    help: flags.help({char: 'h'}),
    // flag with a value (-s, --startDate=VALUE)
    startDate: flags.string({
      char: 's',
      required: false,
      default: getDate(),
      description: 'start date you want to get wave availiability from in the format yearmonthday (YYYY-MM-DD) ie 2021-11-08 - defaults to now'}
    ),
    // flag with a value (-e, --endDate=VALUE)
    endDate: flags.string({
      char: 'e',
      required: false,
      default: getDate(addDays(new Date(), 30)),
      description: 'end date you want to get wave availiability from in the format yearmonthday (YYYY-MM-DD) ie 2021-11-08 - defaults to 30 days from now'}
    )
  }

  static args = [
    {name: 'startDate'},
    {name: 'endDate'},
  ]

  async run() {
    process.setMaxListeners(Infinity)
    //parse command line arguments
    const {args, flags} = this.parse(WaveScraper)

    const startDate: Date = parseDate(flags.startDate)
    const endDate: Date = parseDate(flags.endDate)

    //if an incorrect date value has been supplied, exit the script
    if(isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      this.error(`start date: ${flags.startDate} or end date: ${flags.endDate} were in the incorrect format`)
    }

    this.log(`dates are start date: ${startDate.toLocaleDateString('en-gb')} and end date: ${endDate.toLocaleDateString('en-gb')}`)

    //This goes to the main booking page for the session type you are interested in ie Advanced etc, and get all the available days for the current month
    const days: CalendarData[] = await getAllSurfDaysThisMonth(SessionTypeUrl.Advanced, SessionType.Advanced);

    //filter only active ones
    const availableDays = days.filter((dayArray) => { return dayArray.classNames?.includes('available')})

    //Go through each available day and get each timeslot data for that day for the session type.
    const surfData = availableDays.map((day) => {
      console.log(day.date, "day.date")
      return getDayData(day.date || startDate.toLocaleDateString('en-gb'), SessionTypeUrl.Advanced, SessionType.Advanced);
    })

    const allSurfData = await Promise.allSettled(surfData);

    const successSurfData = allSurfData.filter((items) => {return items.status === 'fulfilled'})

    const successfullSurfDataValues: Slot[][] = successSurfData.map((items) => {
      const item = items as PromiseFulfilledResult<DayData>;
        return item.value?.sessions
      }
    );

    console.log(successfullSurfDataValues, "successfullSurfDataValues");

    const errors = allSurfData
      .filter((items) => {return items.status === 'rejected'})
      .map((items) => {
        const item = items as PromiseRejectedResult;
        return item.reason
      });

      console.log(errors, "this is final errors !")
    const dayData: DayData = {
      sessions: successfullSurfDataValues.flat(2)
    }

    console.log(dayData, "this is final day data !")


    writeDataToFile(dayData);
    logErrors(errors);

    this.exit();

  }
}

const logErrors = (errors: any[]):void => {
  console.log(errors);
}

const writeDataToFile = (dayData: DayData): void => {
  fs.writeFile('./currentSurfData.json', JSON.stringify(dayData, null, 2), err => {
    if (err) {
      console.error(err)
      return
    }
  })
}

const getAllSurfDaysThisMonth = async (sessionTypeUrl: SessionTypeUrl, sessionType: SessionType): Promise<CalendarData[]> => {
  // get all the days for the month

  const browser = await puppeteer.launch({ headless: HEADLESS });
  const page = await browser.newPage();
  await page.goto(`https://bookings.thewave.com/twb_b2c/${sessionTypeUrl}`);
  const daysThisMonth = await page.$$eval('.datepicker-days td', (element) => {
    return element.map(nodes => {
      return {
        classNames: nodes.getAttribute('class'),
        date: nodes.getAttribute('data-date')
      };
    })
  });

  // //click the next button on the calendar to get next months listing
  // await page.click('th.next');
  // await page.waitForTimeout(1000);

  // const daysNextMonth = await page.$$eval('.datepicker-days td', (element) => {
  //   return element.map(nodes => {
  //     return {
  //       classNames: nodes.getAttribute('class'),
  //       date: nodes.getAttribute('data-date')
  //     };
  //   })
  // });
  console.log(daysThisMonth, "days this month")
  //console.log(daysNextMonth, "days next month")
  await browser.close();

  return daysThisMonth.map((dayThisMonth) => {
    return {
      classNames: dayThisMonth.classNames || '',
      date: dayThisMonth.date || '',
      sessionType: sessionType
    };
  })
}

export = WaveScraper
