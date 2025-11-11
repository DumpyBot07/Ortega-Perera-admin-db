// Carga las variables de entorno
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

// --- INICIO CRUD DE PRODUCTOS ---
/**
 * [POST] /api/products
 */
app.post("/api/products", async (req, res) => {
  const { name, description, price, stock, image } = req.body;
  if (!name || !price || stock === undefined) {
    return res.status(400).json({
      error: "Los campos name, price, y stock son obligatorios",
    });
  }
  try {
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
 */
app.get("/api/products", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM products");
    res.json(rows);
  } catch (err) {
    console.error("Error executing query", err);
    res.status(500).send("Error retrieving products");
  }
});

/**
 * [GET] /api/products/:id
 */
app.get("/api/products/:id", async (req, res) => {
  const { id } = req.params;
  try {
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
 */
app.put("/api/products/:id", async (req, res) => {
  const { id } = req.params;
  const { name, description, price, stock, image } = req.body;
  if (!name || !price || stock === undefined) {
    return res.status(400).json({
      error: "Los campos name, price, y stock son obligatorios",
    });
  }
  try {
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
 */
app.delete("/api/products/:id", async (req, res) => {
  const { id } = req.params;
  try {
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

/**
 * [GET] /api/purchases
 */
app.get("/api/purchases", async (req, res) => {
  const query = `
      SELECT 
          p.id AS purchase_id, p.total, p.status, p.purchase_date,
          u.name AS user_name,
          pd.id AS detail_id, pd.quantity, pd.price, pd.subtotal,
          pr.name AS product_name
      FROM purchases p
      JOIN users u ON p.user_id = u.id
      LEFT JOIN purchase_details pd ON p.id = pd.purchase_id
      LEFT JOIN products pr ON pd.product_id = pr.id
      ORDER BY p.id, pd.id;
  `;
  try {
    const [rows] = await pool.query(query);
    const purchasesMap = new Map();
    for (const row of rows) {
      if (!purchasesMap.has(row.purchase_id)) {
        purchasesMap.set(row.purchase_id, {
          id: row.purchase_id,
          user: row.user_name,
          total: row.total,
          status: row.status,
          purchase_date: row.purchase_date,
          details: [],
        });
      }
      if (row.detail_id) {
        purchasesMap.get(row.purchase_id).details.push({
          id: row.detail_id,
          product: row.product_name,
          quantity: row.quantity,
          price: row.price,
          subtotal: row.subtotal,
        });
      }
    }
    const result = Array.from(purchasesMap.values());
    res.json(result);
  } catch (err) {
    console.error("Error executing query", err);
    res.status(500).send("Error retrieving purchases");
  }
});

/**
 * [GET] /api/purchases/:id
 */
app.get("/api/purchases/:id", async (req, res) => {
  const { id } = req.params;
  const query = `
      SELECT 
          p.id AS purchase_id, p.total, p.status, p.purchase_date,
          u.name AS user_name,
          pd.id AS detail_id, pd.quantity, pd.price, pd.subtotal,
          pr.name AS product_name
      FROM purchases p
      JOIN users u ON p.user_id = u.id
      LEFT JOIN purchase_details pd ON p.id = pd.purchase_id
      LEFT JOIN products pr ON pd.product_id = pr.id
      WHERE p.id = ?;
  `;
  try {
    const [rows] = await pool.query(query, [id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: "Compra no encontrada" });
    }
    const purchaseResult = {
      id: rows[0].purchase_id,
      user: rows[0].user_name,
      total: rows[0].total,
      status: rows[0].status,
      purchase_date: rows[0].purchase_date,
      details: [],
    };
    for (const row of rows) {
      if (row.detail_id) {
        purchaseResult.details.push({
          id: row.detail_id,
          product: row.product_name,
          quantity: row.quantity,
          price: row.price,
          subtotal: row.subtotal,
        });
      }
    }
    res.json(purchaseResult);
  } catch (err) {
    console.error("Error executing query", err);
    res.status(500).send("Error retrieving purchase");
  }
});

// Iniciar el servidor
app.listen(port, () => {
  console.log(`App listening at http://localhost:${port}`);
  console.log("Intentando conectar a la base de datos...");
});
