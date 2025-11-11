// Carga las variables de entorno del archivo .env
require("dotenv").config();

const express = require("express");
const app = express();
const port = 3000;

// Middleware para parsear JSON
app.use(express.json());
const mysql = require("mysql2/promise");

// Configura el pool de la base de datos usando las variables de entorno
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306,
  connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT) || 10,
});

app.get("/", (req, res) => {
  res.send("API de Tareas (Productos y Compras) funcionando");
});

// Iniciar el servidor
app.listen(port, () => {
  console.log(`App listening at http://localhost:${port}`);
  console.log("Intentando conectar a la base de datos...");
});
