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
  res.send("API de Productos funcionando");
});

// --- CRUD DE PRODUCTOS (TAREA) ---
// Base URL: /api/products

/**
 * [POST] /api/products
 * Crear un nuevo producto
 */
app.post("/api/products", async (req, res) => {
  // Campos del body basados en el PDF
  const { name, description, price, stock, image } = req.body;

  // Validación
  if (!name || !price || stock === undefined) {
    return res.status(400).json({
      error: "Los campos name, price, y stock son obligatorios",
    });
  }

  try {
    // SQL basado en el PDF
    const query =
      "INSERT INTO products (name, description, price, stock, image, created_at) VALUES (?, ?, ?, ?, ?, NOW())";

    const [result] = await pool.query(query, [
      name,
      description || null,
      price,
      stock,
      image || null,
    ]);

    res.status(201).json({
      message: "Producto creado exitosamente",
      id: result.insertId,
    });
  } catch (err) {
    console.error("Error creating product", err);
    res.status(500).json({
      error: "Error interno del servidor al crear el producto",
    });
  }
});

/**
 * [GET] /api/products
 * Obtener todos los productos
 */
app.get("/api/products", async (req, res) => {
  try {
    // SQL basado en el PDF
    const [rows] = await pool.query("SELECT * FROM products");
    res.json(rows);
  } catch (err) {
    console.error("Error executing query", err);
    res.status(500).send("Error retrieving products");
  }
});

/**
 * [GET] /api/products/:id
 * Obtener un producto por ID
 */
app.get("/api/products/:id", async (req, res) => {
  const { id } = req.params;

  try {
    // SQL basado en el PDF
    const [rows] = await pool.query("SELECT * FROM products WHERE id = ?", [
      id,
    ]);

    if (rows.length === 0) {
      return res.status(404).json({ error: "Producto no encontrado" });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error("Error executing query", err);
    res.status(500).send("Error retrieving product");
  }
});

/**
 * [PUT] /api/products/:id
 * Actualizar un producto existente
 */
app.put("/api/products/:id", async (req, res) => {
  const { id } = req.params;
  // Campos del body basados en el PDF
  const { name, description, price, stock, image } = req.body;

  if (!name || !price || stock === undefined) {
    return res.status(400).json({
      error: "Los campos name, price, y stock son obligatorios",
    });
  }

  try {
    // SQL basado en el PDF
    const query = `
            UPDATE products
            SET name = ?, description = ?, price = ?, stock = ?, image = ?
            WHERE id = ?
        `;

    const [result] = await pool.query(query, [
      name,
      description || null,
      price,
      stock,
      image || null,
      id,
    ]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Producto no encontrado" });
    }

    res.json({
      message: "Producto actualizado exitosamente",
      id: id,
    });
  } catch (err) {
    console.error("Error updating product", err);
    res.status(500).json({
      error: "Error interno del servidor al actualizar el producto",
    });
  }
});

/**
 * [DELETE] /api/products/:id
 * Eliminar un producto por ID
 */
app.delete("/api/products/:id", async (req, res) => {
  const { id } = req.params;

  try {
    // SQL basado en el PDF
    const [result] = await pool.query("DELETE FROM products WHERE id = ?", [
      id,
    ]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Producto no encontrado" });
    }

    res.json({ message: "Producto eliminado exitosamente" });
  } catch (err) {
    console.error("Error deleting product", err);
    res.status(500).send("Error deleting product");
  }
});

// --- FIN CRUD DE PRODUCTOS ---

app.listen(port, () => {
  console.log(`App listening at http://localhost:${port}`);
  console.log("Intentando conectar a la base de datos de AWS RDS...");
});
