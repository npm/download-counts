CREATE TABLE `downloads` (
  `id` char(36) NOT NULL,
  `package` varchar(2000) NOT NULL,
  `downloads` int(10) unsigned NOT NULL,
  `day` datetime NOT NULL,
  `updated` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `package-day` (`package`(255),`day`),
  KEY `day` (`day`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;