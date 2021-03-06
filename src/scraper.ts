import { format } from 'date-fns';
import * as puppeteer from 'puppeteer'
import { parseDate } from './utils';

export const HEADLESS = true;

export type Time = {
  time: string,
  date: string,
}

export enum Side {
  Left = "left",
  Right = "right"
}

export enum SessionTypeUrl {
  Advanced = "advanced.html",
  Intermediate = "pool.html",
  AdvancedPlus = "lessonpool.html",
  ExpertBarrels = "genericevent.html?event=TWB.EVN17",
  ExpertTurns = "genericevent.html?event=TWB.EVN10",
  Waikiki = "genericevent.html?event=TWB.EVN12",
  Beginner = "genericevent.html?event=TWB.EVN13",
  BeginnerLesson = "lesson.html"

}

export enum SessionType {
  Advanced = "Advanced",
  Intermediate = "Intermediate",
  AdvancedPlus = "Advanced Plus",
  ExpertBarrels = "Expert Barrels",
  ExpertTurns = "Expert Turns",
  Waikiki = "Waikiki",
  Beginner = "Beginner",
  BeginnerLesson = "Beginner Lesson",
}

export type Slot = {
  sessionType: SessionType,
  date: string,
  time: string,
  availiability: number,
  side: Side
}

export type SoldOut = {};

export type DayData = {
  sessions: Slot[]
}

const getVisibleDaysToSelect = async (date: string, sessionTypeUrl: SessionTypeUrl): Promise<(string | null)[] | undefined> => {
  const browser = await puppeteer.launch({ headless: HEADLESS });
  const page = await browser.newPage();
  await page.goto(`https://bookings.thewave.com/twb_b2c/${sessionTypeUrl}`);

  //if we are checking next month, we need to click the next button on the calendar
  // if(new Date(date).getMonth() !== new Date().getMonth()) {
  //   await page.click('th.next');
  //   await page.waitForTimeout(1000);
  // }

  await page.waitForSelector(`td[data-date="${date}"]`)
  await page.click(`td[data-date="${date}"]`);

  await page.waitForSelector('div#calendar-dp div:not(.d-none).daybox ul.calendar-time form');

  const returnItems =  await page.evaluate(() => {
    if (document) {
      return Array.from(document.querySelectorAll('div#calendar-dp div:not(.d-none).daybox ul.calendar-time form')).map((values) => {return values.getAttribute('id')})
    }
  });
  await browser.close()
  return returnItems;
}

export const getSingleSlotData = async(date: string, id: string, sessionTypeUrl: SessionTypeUrl, sessionType: SessionType) => {
  try {
    const browser = await puppeteer.launch({ headless: HEADLESS });
    const page = await browser.newPage();
    await page.goto(`https://bookings.thewave.com/twb_b2c/${sessionTypeUrl}`);
    await page.waitForTimeout(1000);

    await page.waitForSelector(`td[data-date="${date}"]`)
    await page.click(`td[data-date="${date}"]`);

    const soldOut = await page.$(`#${id} .calendar-time__item--soldout`);

    if (soldOut) {
      const sessionTime = await page.$eval(`#${id} input[type=submit]`, (node) => { return node.getAttribute("value")})
      return getEmptySlot(date, sessionTime || '', sessionType)
    } else {
      await page.waitForSelector(`#${id} li.ajax-submit`);
      await page.click(`#${id} li.ajax-submit`, {clickCount: 2} );
      await page.waitForSelector('div#tickets-list input.remaining');

      const availabilityForFirstTimeSlotOfDay = await page.$$eval('div#tickets-list input.remaining', (htmlNode) => {
        return htmlNode.map(nodes => {
          return nodes.getAttribute('value');
        });
      });
      const timeSlot = await page.$eval('#datetimeselected', (htmlNode) => {return htmlNode.textContent}) || '';
      const availabilityWithoutNulls = availabilityForFirstTimeSlotOfDay.map((value) => {return value || ''});
      const slot: Slot[] = buildDayData(availabilityWithoutNulls, timeSlot, sessionType);
      console.log(slot, "slot Data")
      await browser.close();

      return slot;
    }

  } catch (error) {
    console.log(error, date, id, sessionTypeUrl, sessionType)
    return [getEmptySlot(date, "asd",  sessionType)]
  }
}

export const getDayData = async (date: string, sessionTypeUrl: SessionTypeUrl, sessionType: SessionType): Promise<DayData> => {
  const visibleFormIds = await getVisibleDaysToSelect(date, sessionTypeUrl);
  const visibleFormIdsNotNull = visibleFormIds || []

  const slots = visibleFormIdsNotNull.map((currentId) => {
    return getSingleSlotData(date, currentId || '', sessionTypeUrl, sessionType)
  })
  const data: DayData = {
    sessions:  (await Promise.all(slots)).flat()
  }

  console.log(data)

  return data;

}

//extract the time and date string from the page and split it into time and date
const getTimeData = (dayDate: string): Time  => {
  //12th November 2021 at 9:00 AM
  const timeDay = dayDate.split(' at ')
  return {
    date: timeDay[0],
    time: timeDay[1]
  }
}

const buildDayData = (availability: string[], timeSlot: string, sessionType: SessionType): Slot[] => {

  const slot: Slot[] = availability.map((value, index) => {
    //The left side is always shown first on the page
    const side = index === 0 ? Side.Left : Side.Right

    const timeData = getTimeData(timeSlot || '')
    return {
      sessionType: sessionType,
      date: timeData.date,
      time: timeData.time,
      availiability: parseInt(value || '0') ,
      side: side
    }
  });

  return slot;
}

const getEmptySlot = (date: string, sessionTime: string, sessionType: SessionType):Slot => {
  console.log(date, "this is error date")
  return {
    availiability: 0,
    sessionType: sessionType,
    date: format(new Date(parseInt(date)), "do MMMM yyyy"),
    time: sessionTime,
    side: Side.Left
  }
}
