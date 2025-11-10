const mysql = require("mysql2/promise");
const pool = mysql.createPool({
  host: "productosdb-instance.ctieimo4a5v5.us-east-2.rds.amazonaws.com",
  user: "admin",
  password: "chanito07",
  database: "productosdb",
});
