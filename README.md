# SubastaFácil

Plataforma web de subastas en línea desarrollada como proyecto académico para la asignatura **Arquitectura de Software**. Permite a los usuarios registrarse, iniciar sesión, explorar subastas, publicar productos, realizar pujas y consultar su perfil e historial de actividad.

El sistema utiliza una arquitectura cliente-servidor que separa la interfaz de usuario, la lógica de negocio y la persistencia de datos.

## Funcionalidades principales

- **Registro e inicio de sesión:** creación de cuentas y autenticación mediante JWT.
- **Exploración, búsqueda y filtros:** consulta de subastas disponibles y filtrado por texto, categoría y rango de precios.
- **Publicación de subastas:** creación de publicaciones con información del producto, precios y fechas.
- **Sistema de pujas:** registro de ofertas respetando las validaciones del servidor y las reglas de la subasta.
- **Perfil e historial del usuario:** consulta de información personal, pujas realizadas y subastas publicadas.
- **Detalle de subasta:** visualización de la descripción, categoría, vendedor, precios, número de ofertas y fechas.

## Arquitectura del proyecto

SubastaFácil está organizado en tres componentes principales:

1. **Frontend:** interfaz de usuario desarrollada con React y Vite.
2. **Backend:** API REST desarrollada con Node.js y Express, encargada de gestionar las solicitudes, las validaciones y las reglas de negocio.
3. **Base de datos:** PostgreSQL, responsable del almacenamiento persistente de usuarios, categorías, subastas y pujas.

El frontend se comunica con el backend mediante solicitudes HTTP. El backend ejecuta las operaciones necesarias y consulta o modifica la base de datos, devolviendo respuestas al frontend en formato JSON.

## Tecnologías utilizadas

| Tecnología | Propósito |
|---|---|
| JavaScript | Lenguaje de programación del frontend y backend |
| React | Construcción de la interfaz de usuario |
| Vite | Entorno de desarrollo del frontend |
| Node.js | Ejecución de JavaScript en el servidor |
| Express | Desarrollo de la API REST |
| PostgreSQL | Gestión de la base de datos relacional |
| CSS | Diseño y estilos de la interfaz |
| JWT | Autenticación mediante tokens |
| Git y GitHub | Control de versiones y colaboración |

## Requisitos previos

Antes de ejecutar el proyecto, instala las siguientes herramientas:

- **Node.js:** versión compatible con las dependencias del proyecto; se recomienda una versión LTS compatible.
- **npm:** gestor de paquetes que se instala normalmente junto con Node.js.
- **PostgreSQL:** servidor de base de datos relacional.
- **Git:** para clonar el repositorio y gestionar las versiones.
- **Visual Studio Code:** recomendado como editor de código.

Para comprobar las instalaciones, abre una terminal de PowerShell y ejecuta:

```powershell
node --version
npm --version
git --version
```

Verifica también que PostgreSQL esté instalado y que su servicio se encuentre en ejecución.

## Instalación y configuración

### 1. Clonar el repositorio

Clona el repositorio y entra en su directorio:

```powershell
git clone https://github.com/magomez36/subastafacil_Arquitectura-de-Software.git
cd subastafacil_Arquitectura-de-Software
```

Si ya tienes el repositorio en tu computadora, abre esa carpeta directamente en Visual Studio Code.

### 2. Configurar la base de datos

Inicia PostgreSQL y crea una base de datos para el proyecto. Por ejemplo, puedes utilizar el nombre `subastafacil`.

Después, ejecuta el script SQL proporcionado por el proyecto:

```text
database/subastafacil_schema.sql
```

Puedes ejecutar el script mediante una herramienta gráfica compatible con PostgreSQL o utilizando `psql`.

Si utilizas `psql`, y el servidor está configurado para aceptar conexiones locales con el usuario `postgres`, los comandos serían similares a los siguientes:

```sql
CREATE DATABASE subastafacil;
```

Después, conecta con la base de datos creada y ejecuta el archivo SQL desde la terminal:

```powershell
psql -U postgres -d subastafacil -f database/subastafacil_schema.sql
```

Ajusta el usuario, la contraseña y los parámetros de conexión a tu instalación local. Si el script incluye datos iniciales, ejecútalo una sola vez sobre una base de datos preparada para la instalación.

### 3. Configurar las variables de entorno del backend

Entra en la carpeta del backend:

```powershell
cd backend
```

Revisa el archivo de ejemplo disponible:

```text
backend/.env.example
```

Crea un archivo `.env` en la carpeta `backend` a partir de ese ejemplo. Puedes hacerlo manualmente desde Visual Studio Code o mediante PowerShell:

```powershell
Copy-Item .env.example .env
```

Abre `backend/.env` y configura los valores correspondientes a tu entorno, utilizando los nombres de variables definidos en `.env.example`.

La configuración debe incluir los parámetros de conexión a PostgreSQL, el puerto del servidor y el secreto utilizado para firmar los tokens JWT, según lo que solicite el proyecto.

**Importante:** utiliza valores propios para tu entorno local. No compartas contraseñas ni secretos reales y no subas el archivo `.env` a GitHub.

### 4. Instalar las dependencias del backend

Desde la carpeta `backend`, ejecuta:

```powershell
npm install
```

Una vez finalizada la instalación, inicia el servidor:

```powershell
npm run dev
```

Si la configuración es correcta, deberías ver un mensaje similar a:

```text
Servidor disponible en http://localhost:3000
```

Mantén esta terminal abierta mientras utilizas la aplicación.

### 5. Instalar las dependencias del frontend

Abre una segunda terminal de PowerShell y vuelve a la raíz del proyecto, si es necesario:

```powershell
cd frontend
npm install
```

Después, ejecuta el servidor de desarrollo:

```powershell
npm run dev
```

Vite mostrará la dirección local en la que se encuentra disponible la aplicación. Normalmente será:

```text
http://localhost:5173/
```

Abre esa dirección en el navegador.

## Verificación del funcionamiento

Una vez que ambos servidores estén ejecutándose, comprueba los siguientes puntos:

1. El frontend se abre correctamente en el navegador.
2. El backend está disponible en `http://localhost:3000`.
3. El endpoint de salud de la API responde correctamente en `http://localhost:3000/api/health`.
4. La conexión con PostgreSQL funciona y el endpoint `http://localhost:3000/api/db-health` devuelve una respuesta satisfactoria.
5. Las subastas y categorías se cargan desde la base de datos.
6. Puedes probar el registro, el inicio de sesión, la publicación de subastas, las búsquedas, las pujas y el perfil del usuario.

Los endpoints de salud permiten comprobar el estado del servidor y la conexión a la base de datos; no sustituyen las pruebas funcionales de cada módulo.

## Control de versiones y colaboración

El proyecto utiliza Git y GitHub para mantener el historial de cambios y facilitar el trabajo colaborativo.

Para contribuir al desarrollo:

1. Actualiza tu rama `main` antes de comenzar una tarea.
2. Crea una rama específica para la funcionalidad que vas a desarrollar.
3. Realiza cambios relacionados con esa tarea y prueba su funcionamiento.
4. Registra los cambios mediante commits con mensajes descriptivos.
5. Publica la rama en GitHub y abre un Pull Request para revisar e integrar los cambios.

Ejemplo de creación de una rama:

```powershell
git switch main
git pull origin main
git switch -c feature/nombre-funcionalidad
```

Después de realizar los cambios:

```powershell
git add .
git commit -m "Implementar nombre de funcionalidad"
git push -u origin feature/nombre-funcionalidad
```

No incluyas archivos `.env`, contraseñas ni secretos en los commits.

## Solución de problemas comunes

**El frontend no carga.** Comprueba que ejecutaste `npm install` y `npm run dev` dentro de `frontend`, y utiliza la dirección que Vite muestra en la terminal.

**La API no responde.** Verifica que el backend esté ejecutándose, que el puerto configurado sea correcto y que no exista otro proceso utilizando ese puerto.

**No hay conexión con PostgreSQL.** Comprueba que el servicio esté activo, que la base de datos exista y que las credenciales del archivo `.env` sean correctas.

**Las subastas no aparecen.** Verifica que el esquema SQL se haya ejecutado, que existan datos para consultar y que el endpoint de subastas responda correctamente.

**Vite muestra un error de importación.** Comprueba que el archivo importado exista y que la ruta relativa corresponda con la ubicación real del componente.

**Las operaciones protegidas devuelven errores de autenticación.** Comprueba que hayas iniciado sesión, que el frontend envíe el token correctamente y que el secreto JWT esté configurado de manera consistente en el backend.

## Consideraciones de seguridad

- No publiques credenciales ni secretos en el repositorio.
- No confíes exclusivamente en las validaciones del frontend.
- Verifica la identidad y los permisos del usuario en el backend.
- Utiliza consultas SQL parametrizadas.
- Configura CORS según los orígenes permitidos.
- Utiliza una configuración adecuada antes de desplegar el sistema fuera del entorno local.

## Estado del proyecto

SubastaFácil es un proyecto académico enfocado en aplicar conceptos de Arquitectura de Software mediante una aplicación web con frontend, API REST y base de datos relacional.

Las funcionalidades descritas corresponden al alcance funcional previsto para esta versión. El estado definitivo de cada una debe comprobarse ejecutando la aplicación y revisando la implementación actual del repositorio.
