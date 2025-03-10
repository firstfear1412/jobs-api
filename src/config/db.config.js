import pkg from "pg";
import dotenv from "dotenv";

const { Pool } = pkg;
dotenv.config();

const DBSERVER = process.env.DBSERVER;
const DBUSER = process.env.DBUSER;
const DBPWD = process.env.DBPWD;
const DBHOST = process.env.DBHOST;
const DBPORT = process.env.DBPORT;
const DB = process.env.DB;
export default new Pool({
  //   connectionString: `postgres://dev:${encodeURI("1234")}@127.0.0.1:5432/kushop`,
  connectionString: `${DBSERVER}://${DBUSER}:${encodeURI(
    DBPWD
  )}@${DBHOST}:${DBPORT}/${DB}`,
});
