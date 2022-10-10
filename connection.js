const Pool = require("pg").Pool;
require("dotenv").config();
// console.log('abc',process.env.NODE_ENV);

const isProduction = process.env.NODE_ENV === "production";
// const connectionString = `postgresql://${process.env.PG_USER}:${process.env.PG_PASSWORD}@${process.env.PG_HOST}:${process.env.PG_PORT}/${process.env.PG_DATABASE}`;
const connectionString = 'postgresql://postgres:postgres@database-1.c6am0oww5fuv.ap-northeast-1.rds.amazonaws.com:5432/postgres'


// const pool = new Pool({
//     connectionString: isProduction ? process.env.DATABASE_URL : connectionString,
//     // ssl: {
//     //     rejectUnauthorized: false,
//     // },
// });
const pool = new Pool({
    connectionString:connectionString,
  })

console.log('conn string: ' + connectionString);
console.log('Connection',pool);
module.exports = pool;
