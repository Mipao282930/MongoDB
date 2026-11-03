const express = require('express');
const { MongoClient } = require('mongodb');

const app = express();
const port = Number(process.env.PORT || 3000);
const client = new MongoClient(process.env.MONGODB_URI);

app.use(express.json({ limit: '32kb' }));
app.use(express.static('public'));

function collection(name) {
  return client.db('control_ventas').collection(name);
}

app.get('/api/clientes', async (req, res, next) => {
  try {
    const clientes = await collection('ventas').aggregate([
      { $group: {
        _id: '$clienteNombre',
        compras: { $sum: 1 },
        total: { $sum: '$total' }
      } },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, nombre: '$_id', compras: 1, total: 1 } }
    ]).toArray();
    res.json(clientes);
  } catch (error) {
    next(error);
  }
});

app.get('/api/productos', async (req, res, next) => {
  try {
    res.json(await collection('productos').find({}, { projection: { _id: 0 } }).sort({ codigo: 1 }).toArray());
  } catch (error) {
    next(error);
  }
});

app.get('/api/ventas', async (req, res, next) => {
  try {
    res.json(await collection('ventas').find({}, { projection: { _id: 0 } }).sort({ fecha: -1 }).toArray());
  } catch (error) {
    next(error);
  }
});

app.get('/api/resumen', async (req, res, next) => {
  try {
    const resumen = await collection('ventas').aggregate([
      { $group: { _id: null, total: { $sum: '$total' }, cantidad: { $sum: 1 } } }
    ]).toArray();
    const { total = 0, cantidad = 0 } = resumen[0] || {};
    const [topClientes, topProductos, stockBajo, clientes] = await Promise.all([
      collection('ventas').aggregate([
        { $group: { _id: '$clienteNombre', compras: { $sum: 1 }, total: { $sum: '$total' } } },
        { $sort: { total: -1 } }
      ]).toArray(),
      collection('ventas').aggregate([
        { $unwind: '$detalle' },
        { $group: { _id: '$detalle.nombre', unidades: { $sum: '$detalle.cantidad' }, ingresos: { $sum: '$detalle.subtotal' } } },
        { $sort: { unidades: -1, ingresos: -1 } }
      ]).toArray(),
      collection('productos').find({ stock: { $lt: 10 } }, { projection: { _id: 0 } }).toArray(),
      collection('ventas').distinct('clienteNombre')
    ]);

    res.json({
      total,
      cantidad,
      ticket: cantidad ? total / cantidad : 0,
      clientes: clientes.length,
      stockBajo,
      topClientes,
      topProductos
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/ventas', async (req, res, next) => {
  const { clienteNombre, items } = req.body || {};
  if (typeof clienteNombre !== 'string' || !clienteNombre.trim() || clienteNombre.trim().length > 100 ||
      !Array.isArray(items) || items.length === 0 || items.length > 50) {
    return res.status(400).json({ error: 'Escriba el nombre del cliente y agregue entre 1 y 50 productos.' });
  }

  const cantidades = new Map();
  for (const item of items) {
    const cantidad = Number(item && item.cantidad);
    if (!item || typeof item.codigo !== 'string' || !Number.isSafeInteger(cantidad) || cantidad < 1) {
      return res.status(400).json({ error: 'Producto o cantidad no válidos.' });
    }
    cantidades.set(item.codigo, (cantidades.get(item.codigo) || 0) + cantidad);
  }

  const detalle = [];
  const descontados = [];

  try {
    for (const [codigo, cantidad] of cantidades) {
      const producto = await collection('productos').findOne({ codigo });
      if (!producto) {
        return res.status(400).json({ error: 'Producto no válido.' });
      }
      if (producto.stock < cantidad) {
        return res.status(400).json({ error: `Stock insuficiente de ${producto.nombre}.` });
      }
      detalle.push({
        producto: producto.codigo,
        nombre: producto.nombre,
        categoria: producto.categoria,
        cantidad,
        precio: producto.precio,
        subtotal: producto.precio * cantidad
      });
    }

    for (const item of detalle) {
      const resultado = await collection('productos').updateOne(
        { codigo: item.producto, stock: { $gte: item.cantidad } },
        { $inc: { stock: -item.cantidad } }
      );
      if (resultado.modifiedCount !== 1) {
        throw new Error(`Stock insuficiente de ${item.nombre}.`);
      }
      descontados.push(item);
    }

    const conteo = await collection('ventas').countDocuments();
    const venta = {
      codigo: `V${String(conteo + 1).padStart(3, '0')}`,
      fecha: new Date(),
      clienteNombre: clienteNombre.trim(),
      estado: 'Pagada',
      total: detalle.reduce((suma, item) => suma + item.subtotal, 0),
      detalle
    };
    await collection('ventas').insertOne(venta);
    delete venta._id;
    return res.status(201).json(venta);
  } catch (error) {
    if (descontados.length) {
      try {
        await collection('productos').bulkWrite(descontados.map(item => ({
          updateOne: {
            filter: { codigo: item.producto },
            update: { $inc: { stock: item.cantidad } }
          }
        })));
      } catch (rollbackError) {
        console.error('Error al restablecer el stock después de una venta fallida:', rollbackError);
        return res.status(500).json({ error: 'No se pudo completar la venta ni restablecer el stock; revise el inventario.' });
      }
    }
    if (error.message.startsWith('Stock insuficiente de ')) {
      return res.status(409).json({ error: error.message });
    }
    return next(error);
  }
});

app.use((error, req, res, next) => {
  console.error(error);
  if (res.headersSent) {
    return next(error);
  }
  return res.status(500).json({ error: 'Error interno del servidor.' });
});

async function start() {
  await client.connect();
  app.listen(port, '0.0.0.0', () => {
    console.log(`Aplicación disponible en el puerto ${port}`);
  });
}

start().catch(error => {
  console.error('No se pudo iniciar la aplicación:', error);
  process.exitCode = 1;
});

async function shutdown() {
  await client.close();
  process.exit();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
