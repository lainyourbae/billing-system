const mysql = require('mysql2');

const db = mysql.createPool({
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  socketPath: process.env.INSTANCE_UNIX_SOCKET,
});

const dbPromise = db.promise();

module.exports = dbPromise;