# npm stats microservice

Gives you download counts. Eventually, maybe other stuff.

## Point values

Gets the total downloads for a given period, for all packages or a specific package.

<code>GET /downloads/point/{period}[/{package}]</code>

### Examples

* /downloads/point/last-day
* /downloads/point/2014-02-01
* /downloads/point/last-week/express
* /downloads/point/2014-02-01:2014-02-08/express
* /downloads/point/last-month/jquery
* /downloads/point/2014-01-10:2014-02-10/jquery

### Parameters

Acceptable values are:

* all-time

  Gets total downloads.

* last-day
  
  Gets downloads for the last available day. In practice, this will usually be "yesterday" (in GMT) but if stats for that day have not yet landed, it will be the day before.
  
* last-week

  Gets downloads for the last 7 available days.
  
* last-month

  Gets downloads for the last 30 available days.



## Ranges

Gets the downloads per day for a given period, for all packages or a specific package.

<code>GET /downloads/range/{period}[/{package}]</code>

### Examples

* /downloads/range/last-week
* /downloads/range/2014-02-07:2014-02-14
* /downloads/range/last-month/jquery
* /downloads/range/2014-01-03:2014-02-03/jquery

### Parameters

Same as for /downloads/point.