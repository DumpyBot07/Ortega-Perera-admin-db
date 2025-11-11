const express = require('express');
const app = express();
const port = 3000;

// Middleware para parsear JSON
app.use(express.json());

const mysql = require('mysql2/promise');

// ! Asegúrate de que estas sean tus credenciales correctas de AWS
const pool = mysql.createPool({
    host: 'AQUÍ_VA_TU_ENDPOINT_DE_AWS',
    user: 'admin',
    password: 'LA_NUEVA_CONTRASEÑA_QUE_PUSISTE',
    database: 'EL_NOMBRE_DE_TU_DB_INICIAL'
});


// --- CRUD DE PRODUCTOS (El que ya tenías) ---
// (He colapsado esto para ahorrar espacio, pero aquí va tu CRUD de /api/products)
app.post("/api/products", async (req, res) => { /* ... tu código ... */ });
app.get("/api/products", async (req, res) => { /* ... tu código ... */ });
app.get("/api/products/:id", async (req, res) => { /* ... tu código ... */ });
app.put("/api/products/:id", async (req, res) => { /* ... tu código ... */ });
app.delete("/api/products/:id", async (req, res) => { /* ... tu código ... */ });


// --- ------------------------------------ ---
// --- INICIO: CRUD DE COMPRAS (Examen-Unidad2) ---
// --- ------------------------------------ ---

/**
 * [POST] /api/purchases
 * Crea una nueva compra con validaciones y transacción.
 */
app.post("/api/purchases", async (req, res) => {
    
    // 1. Obtener datos del body [cite: 133-148]
    const { user_id, status, details } = req.body;

    // 2. Validaciones Simples (Basadas en el PDF)
    if (!user_id || !status || !details) {
        return res.status(400).json({ error: "user_id, status, y details son obligatorios" }); [cite: 128]
    }
    if (!Array.isArray(details) || details.length === 0) {
        return res.status(400).json({ error: "Debe haber al menos un producto" }); [cite: 129]
    }
    if (details.length > 5) {
        return res.status(400).json({ error: "No se pueden guardar más de 5 productos" }); [cite: 126]
    }

    // 3. Iniciar Transacción
    // Esto es vital. Obtenemos una conexión única del pool.
    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        let totalCompra = 0;
        const productosParaActualizar = [];

        // 4. Validaciones Complejas (Stock y Precio)
        for (const item of details) {
            if (!item.product_id || !item.quantity || !item.price) {
                // [cite: 128]
                throw new Error("Cada 'detail' debe tener product_id, quantity, y price");
            }

            // Consultamos el producto PARA BLOQUEARLO (FOR UPDATE)
            // Esto evita que dos personas compren el mismo último item
            const [rows] = await connection.query('SELECT stock FROM products WHERE id = ? FOR UPDATE', [item.product_id]);
            
            if (rows.length === 0) {
                throw new Error(`El producto con id ${item.product_id} no existe.`);
            }

            const stockDisponible = rows[0].stock;
            if (stockDisponible < item.quantity) {
                // 
                throw new Error(`Stock insuficiente para el producto ${item.product_id}. Stock: ${stockDisponible}`);
            }

            // Acumulamos el total
            totalCompra += item.price * item.quantity;
            
            // Guardamos la info para actualizar el stock al final
            productosParaActualizar.push({
                id: item.product_id,
                newStock: stockDisponible - item.quantity
            });
        }

        // 5. Validación del Total
        if (totalCompra > 3500) {
            // 
            throw new Error(`El total de la compra (${totalCompra}) excede los $3500.`);
        }

        // 6. EJECUTAR LOS INSERTS (Ahora que todo es válido)

        // Insertar en 'purchases'
        const purchaseQuery = 'INSERT INTO purchases (user_id, total, status, purchase_date) VALUES (?, ?, ?, NOW())'; [cite: 125]
        const [purchaseResult] = await connection.query(purchaseQuery, [user_id, totalCompra, status]);
        const newPurchaseId = purchaseResult.insertId;

        // Insertar en 'purchase_details'
        for (const item of details) {
            const subtotal = item.price * item.quantity;
            const detailQuery = 'INSERT INTO purchase_details (purchase_id, product_id, quantity, price, subtotal) VALUES (?, ?, ?, ?, ?)';
            await connection.query(detailQuery, [newPurchaseId, item.product_id, item.quantity, item.price, subtotal]);
        }

        // 7. EJECUTAR LAS ACTUALIZACIONES DE STOCK
        for (const prod of productosParaActualizar) {
            // 
            await connection.query('UPDATE products SET stock = ? WHERE id = ?', [prod.newStock, prod.id]);
        }

        // 8. ¡ÉXITO! Confirmar la transacción
        await connection.commit();
        res.status(201).json({ message: 'Compra creada exitosamente', purchase_id: newPurchaseId });

    } catch (err) {
        // 9. ¡ERROR! Revertir la transacción
        if (connection) {
            await connection.rollback();
        }
        // Devolvemos el mensaje de error específico (ej. "Stock insuficiente...")
        res.status(400).json({ error: err.message });

    } finally {
        // 10. Siempre liberar la conexión
        if (connection) {
            connection.release();
        }
    }
});


/**
 * [DELETE] /api/purchases/{id}
 * Elimina una compra y sus detalles.
 */
app.delete("/api/purchases/:id", async (req, res) => {
    const { id } = req.params;
    
    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        // 1. Validar el status [cite: 177]
        const [purchaseRows] = await connection.query('SELECT status FROM purchases WHERE id = ?', [id]);
        if (purchaseRows.length === 0) {
            throw new Error('Compra no encontrada');
        }
        if (purchaseRows[0].status === 'COMPLETED') {
            throw new Error('No se pueden borrar compras que ya se encuentren en estatus "COMPLETED"'); [cite: 177]
        }

        // 2. Borrar detalles (Requerido por FK) [cite: 176]
        await connection.query('DELETE FROM purchase_details WHERE purchase_id = ?', [id]);
        
        // 3. Borrar compra [cite: 176]
        await connection.query('DELETE FROM purchases WHERE id = ?', [id]);

        // 4. Confirmar
        await connection.commit();
        res.json({ message: 'Compra eliminada exitosamente' });

    } catch (err) {
        if (connection) await connection.rollback();
        res.status(400).json({ error: err.message });
    } finally {
        if (connection) connection.release();
    }
});


/**
 * [GET] /api/purchases
 * Obtiene todas las compras con sus detalles (usando JOINs)
 */
app.get("/api/purchases", async (req, res) => {
    
    // Esta consulta trae toda la info de 4 tablas [cite: 180]
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

        // 1. Mapear los resultados (agrupar)
        const purchasesMap = new Map();

        for (const row of rows) {
            // Si la compra no está en el mapa, la agregamos
            if (!purchasesMap.has(row.purchase_id)) {
                purchasesMap.set(row.purchase_id, {
                    id: row.purchase_id, // [cite: 184]
                    user: row.user_name, // [cite: 185]
                    total: row.total, // [cite: 186]
                    status: row.status, // [cite: 187]
                    purchase_date: row.purchase_date, // [cite: 188]
                    details: [] // [cite: 189]
                });
            }

            // Agregar el detalle al array 'details' de esa compra
            if (row.detail_id) { // Solo si la compra tiene detalles (LEFT JOIN)
                purchasesMap.get(row.purchase_id).details.push({
                    id: row.detail_id, // [cite: 191]
                    product: row.product_name, // [cite: 192]
                    quantity: row.quantity, // [cite: 193]
                    price: row.price, // [cite: 194]
                    subtotal: row.subtotal // [cite: 195]
                });
            }
        }

        // 2. Convertir el mapa a un array
        const result = Array.from(purchasesMap.values());
        res.json(result);

    } catch (err) {
        console.error('Error executing query', err);
        res.status(500).send('Error retrieving purchases');
    }
});


/**
 * [GET] /api/purchases/{id}
 * Obtiene una compra específica por ID (usando JOINs)
 */
app.get("/api/purchases/:id", async (req, res) => {
    const { id } = req.params;

    // Consulta similar, pero filtrada por ID [cite: 209]
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
            return res.status(404).json({ error: 'Compra no encontrada' });
        }

        // 1. Mapear (esta vez solo hay un objeto principal)
        // Usamos los datos de la primera fila para la compra
        const purchaseResult = {
            id: rows[0].purchase_id, // [cite: 212]
            user: rows[0].user_name, // [cite: 213]
            total: rows[0].total, // [cite: 214]
            status: rows[0].status, // [cite: 215]
            purchase_date: rows[0].purchase_date, // [cite: 216]
            details: [] // [cite: 217]
        };

        // 2. Recorrer todas las filas (detalles) y agregarlas
        for (const row of rows) {
            if (row.detail_id) {
                purchaseResult.details.push({
                    id: row.detail_id, // [cite: 219, 228]
                    product: row.product_name, // [cite: 220, 229]
                    quantity: row.quantity, // [cite: 221, 230]
                    price: row.price, // [cite: 226, 231]
                    subtotal: row.subtotal // [cite: 227, 232]
                });
            }
        }
        
        res.json(purchaseResult);

    } catch (err) {
        console.error('Error executing query', err);
        res.status(500).send('Error retrieving purchase');
    }
});


// --- FIN CRUD DE COMPRAS ---


// Iniciar el servidor
app.listen(port, () => {
    console.log(`App listening at http://localhost:${port}`);
    console.log('Conectado a la base de datos de AWS RDS.');
});