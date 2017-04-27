# npm stats microservice

__Note!__ This code base isn't what npm uses to serve download counts anymore, and its documentation is likely to drift out of correctness as time passes. See [the registry API documentation](https://github.com/npm/registry/blob/master/docs/download-counts.md) for up-to-date usage info.

Gives you download counts. Eventually, maybe other stuff.

Our blog has an explanation of [how npm download counts work](http://blog.npmjs.org/post/92574016600/numeric-precision-matters-how-npm-download-counts), including "what counts as a download?"

## Data source

npm's raw log data is continuously written to a series of buckets on AWS S3. Once per day, soon 
after UTC midnight, a map-reduce cluster is spun up that crunches the previous day's logs and
pushes them into the database. Because this is UTC this creates some slightly unintuitive results,
e.g. if you are on the west coast on the 19th of September, the data for the 19th of September will
become available at 5pm (because UTC already moved to the 20th) during the winter, but not until 6pm
during the summer, because the US observes daylight savings but UTC is fixed.

## Point values

Gets the total downloads for a given period, for all packages or a specific package.

<code>GET https://api.npmjs.org/downloads/point/{period}[/{package}]</code>

### Examples

<dl>
	<dt>All packages, last day:</dt>
	<dd><a href="https://api.npmjs.org/downloads/point/last-day">/downloads/point/last-day</a></dd>
	<dt>All packages, specific date:</dt>
	<dd><a href="https://api.npmjs.org/downloads/point/2014-02-01">/downloads/point/2014-02-01</a></dd>
	<dt>Package "express", last week:</dt>
	<dd><a href="https://api.npmjs.org/downloads/point/last-week/express">/downloads/point/last-week/express</a></dd>
	<dt>Package "express", given 7-day period:</dt>
	<dd><a href="https://api.npmjs.org/downloads/point/2014-02-01:2014-02-08/express">/downloads/point/2014-02-01:2014-02-08/express</a></dd>
	<dt>Package "jquery", last 30 days:</dt>
	<dd><a href="https://api.npmjs.org/downloads/point/last-month/jquery">/downloads/point/last-month/jquery</a></dd>
	<dt>Package "jquery", specific month:</dt>
	<dd><a href="https://api.npmjs.org/downloads/point/2014-01-01:2014-01-31/jquery">/downloads/point/2014-01-01:2014-01-31/jquery</a></dd>
</dl>

### Parameters

Acceptable values are:


<dl>
	<!--
	<dt>all-time</dt>
	<dd>Gets total downloads.</dd>
	-->
	<dt>last-day</dt>
	<dd>Gets downloads for the last available day. In practice, this will usually be "yesterday" (in GMT) but if stats for that day have not yet landed, it will be the day before.</dd>
	<dt>last-week</dt>
	<dd>Gets downloads for the last 7 available days.</dd>
  	<dt>last-month</dt>
	<dd>Gets downloads for the last 30 available days.</dd>
</dl>

### Output

The following incredibly simple JSON is the output:

```javascript
{
  downloads: 31623,
  start: "2014-01-01",
  end: "2014-01-31",
  package: "jquery"
}
```

If you have not specified a package, that key will not be present. The start and end dates are inclusive.

## Ranges

Gets the downloads per day for a given period, for all packages or a specific package.

<code>GET https://api.npmjs.org/downloads/range/{period}[/{package}]</code>

### Examples

<dl>
	<dt>Downloads per day, last 7 days</dt>
	<dd><a href="https://api.npmjs.org/downloads/range/last-week">/downloads/range/last-week</a></dd>
	<dt>Downloads per day, specific 7 days</dt>
	<dd><a href="https://api.npmjs.org/downloads/range/2014-02-07:2014-02-14">/downloads/range/2014-02-07:2014-02-14</a></dd>
	<dt>Downloads per day, last 30 days</dt>
	<dd><a href="https://api.npmjs.org/downloads/range/last-month/jquery">/downloads/range/last-month/jquery</a></dd>
	<dt>Downloads per day, specific 30 day period</dt>
	<dd><a href="https://api.npmjs.org/downloads/range/2014-01-03:2014-02-03/jquery">/downloads/range/2014-01-03:2014-02-03/jquery</a></dd>
</dl>

### Parameters

Same as for /downloads/point.

### Output

Responses are very similar to the point API, except that downloads is now an array of days with downloads on each day:

```javascript
{
	downloads: [
		{
			day: "2014-02-27",
			downloads: 1904088
		},
		..
		{
			day: "2014-03-04",
			downloads: 7904294
		}
	],
	start: "2014-02-25",
	end: "2014-03-04",
	package: "somepackage"
}
```

As before, the package key will not be present if you have not specified a package.

## Bulk Queries

To perform a bulk query, you can hit the range or point endpoints with a comma
separated list of packages rather than a single package, e.g.,

`/downloads/point/last-day/npm,express`

## Development

The code requires node and a mysql database to talk to. We have a conveniently
pre-configured VM available for download. First, install VirtualBox:

https://www.virtualbox.org/wiki/Downloads

And then install Vagrant:

https://www.vagrantup.com/downloads.html

Now just cd into the root of this repo and run

<code>vagrant up</code>

When you see "Done!" you are ready to rock.

### Running the web service

Install dependencies:

<code>npm install</code>

You will need a config file:

<code>cp test/config.dev.js config.js</code>

For development, you shouldn't need to change anything in here
unless your VM didn't come up at the usual IP (192.168.33.10)

Run the server on port 3000:

<code>node index.js 3000</code>

Test that it's working:

<code>curl "http://localhost:3000/downloads/point/2014-03-01"</code>

You can ssh into the VM to play with MySQL or whatever:

<code>vagrant ssh</code>

### Importing data from S3 (npm, Inc. only)

New data is generated daily and stored in S3. You can get it with the 
backfill script like so:

<code>node scripts/backfill.js YYYY-MM-DD N</code>

YYYY-MM-DD is the date you want new data to start. If omitted,
it will start importing from the first available data, which is
a bad idea except when creating a new production host

N is the number of days to import after that date. If omitted,
it will import all available days. So to get everything after
April 1, for instance, run

<code>node scripts/backfill.js 2014-04-01</code>

For the AWS JS SDK to work, you must have a `~/.aws/credentials` file 
containing

```
aws_access_key_id = XXXXX
aws_secret_access_key = YYYYY
```

Where X and Y are your AWS access credentials. The production server has
its own credentials specifically for this purpose.
