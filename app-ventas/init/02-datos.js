const ventasDb = db.getSiblingDB('control_ventas');

ventasDb.createCollection('clientes');
ventasDb.createCollection('productos', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['codigo', 'nombre', 'precio', 'stock'],
      properties: {
        codigo: { bsonType: 'string' },
        nombre: { bsonType: 'string' },
        precio: { bsonType: ['int', 'long', 'double', 'decimal'], minimum: 0 },
        stock: { bsonType: ['int', 'long'], minimum: 0 }
      }
    }
  }
});
ventasDb.createCollection('ventas');

ventasDb.clientes.createIndex({ codigo: 1 }, { unique: true });
ventasDb.productos.createIndex({ codigo: 1 }, { unique: true });
ventasDb.ventas.createIndex({ codigo: 1 }, { unique: true });
ventasDb.ventas.createIndex({ clienteNombre: 1 });
ventasDb.ventas.createIndex({ fecha: -1 });

ventasDb.productos.insertMany([
  { codigo: 'P001', nombre: 'Laptop HP 15', categoria: 'Cómputo', precio: 2500, stock: 7 },
  { codigo: 'P002', nombre: 'Mouse inalámbrico', categoria: 'Accesorios', precio: 45, stock: 44 },
  { codigo: 'P003', nombre: 'Teclado mecánico', categoria: 'Accesorios', precio: 180, stock: 22 },
  { codigo: 'P004', nombre: 'Monitor 24 pulgadas', categoria: 'Cómputo', precio: 650, stock: 12 },
  { codigo: 'P005', nombre: 'Impresora multifuncional', categoria: 'Oficina', precio: 520, stock: 7 },
  { codigo: 'P006', nombre: 'Disco SSD 1TB', categoria: 'Almacenamiento', precio: 310, stock: 16 }
]);
