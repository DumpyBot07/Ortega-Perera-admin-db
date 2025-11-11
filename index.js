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

/**
 * [POST] /api/purchases
 */
app.post("/api/purchases", async (req, res) => {
  const { user_id, status, details } = req.body;
  if (!user_id || !status || !details) {
    return res
      .status(400)
      .json({ error: "user_id, status, y details son obligatorios" });
  }
  if (!Array.isArray(details) || details.length === 0) {
    return res.status(400).json({ error: "Debe haber al menos un producto" });
  }
  if (details.length > 5) {
    return res
      .status(400)
      .json({ error: "No se pueden guardar más de 5 productos" });
  }
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    let totalCompra = 0;
    const productosParaActualizar = [];
    for (const item of details) {
      if (!item.product_id || !item.quantity || !item.price) {
        throw new Error(
          "Cada 'detail' debe tener product_id, quantity, y price"
        );
      }
      const [rows] = await connection.query(
        "SELECT stock FROM products WHERE id = ? FOR UPDATE",
        [item.product_id]
      );
      if (rows.length === 0) {
        throw new Error(`El producto con id ${item.product_id} no existe.`);
      }
      const stockDisponible = rows[0].stock;
      if (stockDisponible < item.quantity) {
        throw new Error(
          `Stock insuficiente para el producto ${item.product_id}. Stock: ${stockDisponible}`
        );
      }
      totalCompra += item.price * item.quantity;
      productosParaActualizar.push({
        id: item.product_id,
        newStock: stockDisponible - item.quantity,
      });
    }
    if (totalCompra > 3500) {
      throw new Error(
        `El total de la compra (${totalCompra}) excede los $3500.`
      );
    }
    const purchaseQuery =
      "INSERT INTO purchases (user_id, total, status, purchase_date) VALUES (?, ?, ?, NOW())";
    const [purchaseResult] = await connection.query(purchaseQuery, [
      user_id,
      totalCompra,
      status,
    ]);
    const newPurchaseId = purchaseResult.insertId;
    for (const item of details) {
      const subtotal = item.price * item.quantity;
      const detailQuery =
        "INSERT INTO purchase_details (purchase_id, product_id, quantity, price, subtotal) VALUES (?, ?, ?, ?, ?)";
      await connection.query(detailQuery, [
        newPurchaseId,
        item.product_id,
        item.quantity,
        item.price,
        subtotal,
      ]);
    }
    for (const prod of productosParaActualizar) {
      await connection.query("UPDATE products SET stock = ? WHERE id = ?", [
        prod.newStock,
        prod.id,
      ]);
    }
    await connection.commit();
    res.status(201).json({
      message: "Compra creada exitosamente",
      purchase_id: newPurchaseId,
    });
  } catch (err) {
    if (connection) {
      await connection.rollback();
    }
    res.status(400).json({ error: err.message });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

/**
 * [DELETE] /api/purchases/{id}
 */
app.delete("/api/purchases/:id", async (req, res) => {
  const { id } = req.params;
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [purchaseRows] = await connection.query(
      "SELECT status FROM purchases WHERE id = ?",
      [id]
    );
    if (purchaseRows.length === 0) {
      throw new Error("Compra no encontrada");
    }
    if (purchaseRows[0].status === "COMPLETED") {
      throw new Error(
        'No se pueden borrar compras que ya se encuentren en estatus "COMPLETED"'
      );
    }
    await connection.query(
      "DELETE FROM purchase_details WHERE purchase_id = ?",
      [id]
    );
    await connection.query("DELETE FROM purchases WHERE id = ?", [id]);
    await connection.commit();
    res.json({ message: "Compra eliminada exitosamente" });
  } catch (err) {
    if (connection) await connection.rollback();
    res.status(400).json({ error: err.message });
  } finally {
    if (connection) connection.release();
  }
});

/**
 * [PUT] /api/purchases/{id}
 */
app.put("/api/purchases/:id", async (req, res) => {
  const { id: purchaseId } = req.params;
  const { user_id, status, details } = req.body;
  if (details && Array.isArray(details) && details.length > 5) {
    return res
      .status(400)
      .json({ error: "No se pueden guardar más de 5 productos" });
  }
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [purchaseRows] = await connection.query(
      "SELECT status FROM purchases WHERE id = ? FOR UPDATE",
      [purchaseId]
    );
    if (purchaseRows.length === 0) {
      throw new Error("Compra no encontrada");
    }
    if (purchaseRows[0].status === "COMPLETED") {
      throw new Error(
        'No se pueden modificar compras que ya se encuentren en estatus "COMPLETED"'
      );
    }
    const [oldDetails] = await connection.query(
      "SELECT product_id, quantity FROM purchase_details WHERE purchase_id = ?",
      [purchaseId]
    );
    for (const item of oldDetails) {
      await connection.query(
        "UPDATE products SET stock = stock + ? WHERE id = ?",
        [item.quantity, item.product_id]
      );
    }
    await connection.query(
      "DELETE FROM purchase_details WHERE purchase_id = ?",
      [purchaseId]
    );
    let newTotalCompra = 0;
    const productosParaActualizar = [];
    if (details && Array.isArray(details)) {
      if (details.length === 0) {
        throw new Error(
          "La lista de detalles no puede estar vacía si se envía para actualizar"
        );
      }
      for (const item of details) {
        if (!item.product_id || !item.quantity || !item.price) {
          throw new Error(
            "Cada 'detail' debe tener product_id, quantity, y price"
          );
        }
        const [rows] = await connection.query(
          "SELECT stock FROM products WHERE id = ? FOR UPDATE",
          [item.product_id]
        );
        if (rows.length === 0) {
          throw new Error(`El producto con id ${item.product_id} no existe.`);
        }
        const stockDisponible = rows[0].stock;
        if (stockDisponible < item.quantity) {
          throw new Error(
            `Stock insuficiente para el producto ${item.product_id}. Stock: ${stockDisponible}`
          );
        }
        newTotalCompra += item.price * item.quantity;
        productosParaActualizar.push({
          id: item.product_id,
          newStock: stockDisponible - item.quantity,
        });
      }
      if (newTotalCompra > 3500) {
        throw new Error(
          `El total de la compra (${newTotalCompra}) excede los $3500.`
        );
      }
      for (const item of details) {
        const subtotal = item.price * item.quantity;
        const detailQuery =
          "INSERT INTO purchase_details (purchase_id, product_id, quantity, price, subtotal) VALUES (?, ?, ?, ?, ?)";
        await connection.query(detailQuery, [
          purchaseId,
          item.product_id,
          item.quantity,
          item.price,
          subtotal,
        ]);
      }
      for (const prod of productosParaActualizar) {
        await connection.query("UPDATE products SET stock = ? WHERE id = ?", [
          prod.newStock,
          prod.id,
        ]);
      }
    }
    const newStatus = status || purchaseRows[0].status;
    const newUserId = user_id || purchaseRows[0].user_id;
    const finalTotal = details ? newTotalCompra : 0;
    await connection.query(
      "UPDATE purchases SET user_id = ?, status = ?, total = ? WHERE id = ?",
      [newUserId, newStatus, finalTotal, purchaseId]
    );
    await connection.commit();
    res.json({
      message: "Compra actualizada exitosamente",
      purchase_id: purchaseId,
    });
  } catch (err) {
    if (connection) {
      await connection.rollback();
    }
    res.status(400).json({ error: err.message });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

// Iniciar el servidor
app.listen(port, () => {
  console.log(`App listening at http://localhost:${port}`);
  console.log("Intentando conectar a la base de datos...");
});
