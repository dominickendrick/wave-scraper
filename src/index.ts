import {Command, flags} from '@oclif/command'
import { getDate, parseDate } from './utils'
import { addDays } from 'date-fns'
import { run } from './scraper';

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
      default: getDate(addDays(new Date(), 1)),
      description: 'end date you want to get wave availiability from in the format yearmonthday (YYYY-MM-DD) ie 2021-11-08 - defaults to 1 day from now'}
    )
  }

  static args = [
    {name: 'startDate'},
    {name: 'endDate'},
  ]

  async run() {
    const {args, flags} = this.parse(WaveScraper)

    const startDate: Date = parseDate(flags.startDate)
    const endDate: Date = parseDate(flags.endDate)

    if(isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      this.error(`start date: ${flags.startDate} or end date: ${flags.endDate} were in the incorrect format`)
    }


    this.log(`dates are start date: ${startDate.toLocaleDateString('en-gb')} and end date: ${endDate.toLocaleDateString('en-gb')}`)

    run(startDate.toLocaleDateString('en-gb'));
  }
}



export = WaveScraper
