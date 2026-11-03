# Actividad: Control de ventas con Hyper-V, Docker y MongoDB

Esta guía adapta el ejercicio de ventas para ejecutarlo en una máquina virtual ligera. La aplicación y MongoDB se ejecutan como contenedores Docker dentro de Ubuntu Server. No es necesario instalar MongoDB, Node.js ni Docker Desktop dentro de Ubuntu.

## Arquitectura

```text
PC con Windows (8 GB RAM)
└── Hyper-V
    └── Ubuntu Server 24.04 LTS (2 procesadores, 2 GB RAM, disco dinámico de 25 GB)
        └── Docker Engine y Docker Compose
            ├── MongoDB 7 (puerto no publicado)
            └── Aplicación Node.js (puerto 3000)
```

Docker que ya está instalado en Windows es independiente del Docker de la máquina virtual. Para esta práctica, los comandos Docker se ejecutan en la terminal de Ubuntu.

## 1. Crear la máquina virtual en Hyper-V

1. Comprueba la edición de Windows en **Configuración > Sistema > Acerca de**. Hyper-V completo está disponible normalmente en Windows Pro, Enterprise y Education; Windows Home no incluye el administrador Hyper-V de forma oficial.
2. Si Hyper-V está disponible, abre **Activar o desactivar las características de Windows**, habilita **Hyper-V** y reinicia si Windows lo solicita. También puedes buscar **Administrador de Hyper-V** en Inicio.
3. Descarga la ISO de **Ubuntu Server 24.04 LTS** desde [ubuntu.com/download/server](https://ubuntu.com/download/server).
4. En Administrador de Hyper-V, selecciona **Nuevo > Máquina virtual** y usa estos valores para el equipo de 8 GB:
   - Nombre: `Ubuntu-Ventas`.
   - Generación: **2**.
   - Memoria de inicio: **2048 MB**. Desactiva la memoria dinámica para que el consumo sea predecible.
   - Red: **Default Switch**.
   - Disco virtual: **25 GB**, tamaño dinámico.
   - Archivo de inicio: selecciona la ISO de Ubuntu Server.
5. Si el arranque seguro impide iniciar la ISO, abre la configuración de la VM, entra en **Seguridad** y selecciona la plantilla de autoridad de certificación UEFI de Microsoft; vuelve a iniciar la VM.
6. Inicia Ubuntu y completa la instalación. Crea un usuario y contraseña que recuerdes. No selecciones un escritorio gráfico. Si el instalador ofrece instalar OpenSSH, puedes seleccionarlo, aunque no es necesario para la práctica.
7. Al terminar, quita/desmonta la ISO desde la configuración de DVD de la VM y reinicia.

> Si el Administrador de Hyper-V no aparece o tu edición de Windows no lo incluye, detente y consulta al docente antes de usar VirtualBox: la consigna especifica Hyper-V.

## 2. Instalar Docker dentro de Ubuntu

Inicia sesión en la VM. Estos comandos se escriben en la terminal de Ubuntu, no en `mongosh`.

```bash
sudo apt update
sudo apt install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker "$USER"
```

Cierra la sesión de Ubuntu y vuelve a entrar para aplicar el grupo Docker. Comprueba la instalación:

```bash
docker --version
docker compose version
docker run --rm hello-world
```

## 3. Copiar el proyecto a Ubuntu

La carpeta `app-ventas` contiene la aplicación, la configuración de Docker y datos de muestra para productos. Las colecciones de clientes y ventas inician sin registros. Copia esa carpeta a Ubuntu, por ejemplo usando una carpeta compartida de Hyper-V, Git si el proyecto está publicado en un repositorio, o `scp` desde Windows.

En Ubuntu, entra en la carpeta:

```bash
cd app-ventas
```

Si la carpeta no se llama así o está en otra ubicación, ajusta el comando a la ruta donde la copiaste.

## 4. Configurar y ejecutar MongoDB y la aplicación

Genera el archivo local de contraseñas desde la plantilla:

```bash
cp .env.example .env
nano .env
```

Cambia los valores de `MONGO_ROOT_PASSWORD` y `APP_PASSWORD` por contraseñas propias para el laboratorio. Usa letras y números para evitar tener que codificar caracteres especiales en la URI. Guarda en `nano` con **Ctrl+O**, **Enter**, **Ctrl+X**. El archivo `.env` está excluido de Git.

Inicia los servicios:

```bash
docker compose up -d --build
docker compose ps
docker compose logs --tail=50 mongo app
```

El primer inicio descarga las imágenes y puede tardar según la conexión. MongoDB conserva los datos en un volumen Docker aunque se recree el contenedor. Los scripts de inicialización se ejecutan solo cuando se crea por primera vez el volumen.

Comprueba el contenido inicial. Sustituye `CONTRASEÑA_ADMIN` por el valor de `MONGO_ROOT_PASSWORD` que guardaste en `.env`:

```bash
docker compose exec mongo mongosh -u admin -p 'CONTRASEÑA_ADMIN' --authenticationDatabase admin control_ventas --eval 'print(db.clientes.countDocuments(), db.productos.countDocuments(), db.ventas.countDocuments())'
```

El resultado esperado al iniciar es `0 6 0`: no hay clientes ni ventas de ejemplo; se conservan seis productos de muestra.

El nombre del cliente se escribe directamente al registrar una venta. La sección **Clientes** muestra los nombres y totales de quienes ya aparecen en ventas registradas.

## 5. Abrir la aplicación

En Ubuntu averigua la dirección IP de la VM:

```bash
hostname -I
```

Desde el navegador de Windows, abre `http://IP_DE_LA_VM:3000`, reemplazando `IP_DE_LA_VM` por la dirección mostrada. La aplicación muestra el dashboard, clientes, productos y ventas, y permite registrar una venta.

La aplicación y MongoDB también pueden probarse desde Ubuntu con:

```bash
curl http://localhost:3000/api/resumen
```

MongoDB no publica el puerto 27017 en la red: la aplicación se conecta por la red privada de Docker. Para consultar la base desde la consola:

```bash
docker compose exec mongo mongosh -u admin -p 'CONTRASEÑA_ADMIN' --authenticationDatabase admin control_ventas
```

En `mongosh`:

```javascript
db.clientes.countDocuments()
db.productos.countDocuments()
db.ventas.countDocuments()
db.productos.find({ precio: { $gt: 300 } })
```

Para salir de `mongosh`, escribe `exit`.

## 6. Ejercicios y resultados esperados

En la interfaz de la aplicación:

1. Revisa los listados de clientes, productos y ventas.
2. En **Nueva venta**, selecciona Luis Ramos y agrega dos Mouse inalámbricos y un Disco SSD 1TB.
3. Registra la venta. Debe ser por S/ 400.00; el total del dashboard debe cambiar a S/ 12420.00 y el número de ventas a 7.
4. Prueba agregar una cantidad superior al stock: la API debe rechazar la operación e informar que no hay stock suficiente.

En `mongosh`, para los ejercicios de la guía:

```javascript
db.clientes.find({ ciudad: 'Lima' })
db.productos.find({ precio: { $gt: 300 } })
db.ventas.find({ total: { $gt: 1000 } }, { codigo: 1, clienteNombre: 1, total: 1, _id: 0 })

db.ventas.aggregate([
  { $unwind: '$detalle' },
  { $group: {
    _id: '$detalle.nombre',
    unidades: { $sum: '$detalle.cantidad' },
    ingresos: { $sum: '$detalle.subtotal' }
  } },
  { $sort: { unidades: -1, ingresos: -1 } }
])

db.ventas.aggregate([
  { $lookup: {
    from: 'clientes',
    localField: 'clienteCodigo',
    foreignField: 'codigo',
    as: 'cliente'
  } },
  { $unwind: '$cliente' },
  { $project: { _id: 0, codigo: 1, total: 1, 'cliente.nombre': 1, 'cliente.ciudad': 1 } }
])
```

Antes de registrar la venta web, el resumen esperado es: 5 clientes, 6 productos, 6 ventas y S/ 12020.00 en ventas. La verificación de cantidades mayores al stock debe hacerse con un pedido fallido: no se debe modificar el stock.

## 7. Capturas sugeridas para entregar

- Hyper-V con la VM Ubuntu encendida.
- `docker compose ps` con ambos servicios activos.
- Conteos de documentos en `mongosh`.
- Dashboard y listado de ventas en el navegador.
- Resultado del pipeline de productos más vendidos.
- Venta de prueba y dashboard actualizado.

## 8. Apagar y volver a iniciar

Para detener los contenedores sin borrar los datos:

```bash
docker compose down
```

Para volver a iniciar:

```bash
docker compose up -d
```

**No ejecutes `docker compose down -v`** salvo que quieras eliminar permanentemente el volumen y todos los datos de la práctica.

## 9. Seguridad y alcance

- Las contraseñas del ejemplo son solo para aprendizaje; cámbialas en `.env`.
- El usuario de la aplicación solo tiene el rol `readWrite` sobre `control_ventas`; no usa el administrador.
- MongoDB no expone su puerto al host ni a la red.
- No publiques la aplicación en Internet; es un laboratorio local.
- La generación secuencial de códigos de venta sirve para esta práctica de un solo usuario, no para una tienda con ventas concurrentes.
