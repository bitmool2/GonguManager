CREATE DATABASE IF NOT EXISTS gongu_manager
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

ALTER USER 'root'@'%' IDENTIFIED WITH mysql_native_password BY 'rootpassword';
CREATE USER IF NOT EXISTS 'gongu'@'%' IDENTIFIED WITH mysql_native_password BY 'gongu1234';
GRANT ALL PRIVILEGES ON *.* TO 'gongu'@'%' WITH GRANT OPTION;
FLUSH PRIVILEGES;
