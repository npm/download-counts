-- create downloads table
CREATE TABLE `downloads` (
  `id` binary(16) NOT NULL,
  `package` varchar(2000) NOT NULL,
  `downloads` int(10) unsigned NOT NULL,
  `day` datetime NOT NULL,
  `updated` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `package-day` (`package`(255),`day`),
  KEY `day` (`day`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- create daily download counts totals table.
CREATE TABLE `total_daily_downloads` (
  `day` datetime NOT NULL,
  `downloads` int(10) unsigned NOT NULL,
  `updated` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`day`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- this will just create an empty totals table
create table download_totals as
  select
    package,
    sum(downloads) as total_downloads
  from downloads
  group by package;
