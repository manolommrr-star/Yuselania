# POS MVP - Vanilla JS + Firebase

Sistema de punto de venta mínimo viable con JavaScript puro y Firebase Firestore.

## 🚀 Setup Rápido

### 1. Crear proyecto en Firebase
1. Ve a [Firebase Console](https://console.firebase.google.com)
2. Create project → Nombre: `pos-yuselania` (o el que quieras)
3. **Authentication** → Sign-in method → **Email/Password** → Enable
4. **Firestore Database** → Create database → **Test mode** (para empezar) → Ubicación: `southamerica-east1` (Buenos Aires)
5. **Project Settings** (⚙️) → General → Your apps → **Web app** (</>) → Copy config

### 2. Configurar credenciales
Edita `firebase-config.js` y reemplaza:
```js
const firebaseConfig = {
  apiKey: "TU_API_KEY",
  authDomain: "TU_PROJECT_ID.firebaseapp.com",
  projectId: "TU_PROJECT_ID",
  storageBucket: "TU_PROJECT_ID.appspot.com",
  messagingSenderId: "TU_SENDER_ID",
  appId: "TU_APP_ID"
};
```

### 3. Crear usuario admin
En Firebase Console → Authentication → Users → Add user:
- Email: `admin@test.com`
- Password: `123456`

### 4. Configurar reglas de seguridad
En Firestore → Rules → Pega el contenido de `firestore.rules` → Publish

### 5. Instalar y correr
```bash
npm install
npm run dev
```
Abre http://localhost:3000

---

## 📦 Estructura de Datos (Firestore)

### `products` (collection)
```js
{
  sku: "PROD-001",           // string, unique
  barcode: "7791234567890",  // string, optional
  name: "Coca Cola 500ml",   // string
  categoryId: "cat-abc123",  // reference to categories
  cost: 150.00,              // number (costo)
  prices: {                  // precios por tipo cliente
    regular: 250.00,
    wholesale: 220.00,
    vip: 200.00
  },
  stock: 100,                // number
  minStock: 10,              // number
  active: true,              // boolean (soft delete)
  createdAt: Timestamp
}
```

### `categories` (collection)
```js
{
  name: "Bebidas",
  createdAt: Timestamp
}
```

### `sales` (collection)
```js
{
  userId: "firebase-uid",
  userEmail: "admin@test.com",
  customerType: "wholesale",  // regular | wholesale | vip
  paymentMethod: "cash",      // cash | card | transfer
  items: [{
    productId: "prod-xyz",
    name: "Coca Cola 500ml",
    sku: "PROD-001",
    price: 220.00,
    cost: 150.00,
    qty: 2,
    subtotal: 440.00
  }],
  subtotal: 500.00,
  discount: 50.00,
  total: 450.00,
  paid: 500.00,
  change: 50.00,
  status: "completed",
  createdAt: Timestamp
}
```

---

## ⌨️ Atajos de Teclado

| Tecla | Acción |
|-------|--------|
| `F2` / `Ctrl+B` | Abrir escáner de código de barras |
| `Enter` (en escáner) | Buscar producto |
| `Click` en producto | Agregar al carrito |
| `+/-` en carrito | Cambiar cantidad |

---

## 🎯 Flujo de Venta

1. **Login** con email/password
2. **Seleccionar tipo cliente** (Regular/Mayorista/VIP) → actualiza precios automáticamente
3. **Buscar productos** por nombre, SKU o código de barras
4. **Click en producto** → se agrega al carrito (valida stock)
5. **Ajustar cantidades** con +/- en el carrito
6. **Seleccionar método de pago**
7. **Si efectivo**: ingresar monto recibido → calcula vuelto
8. **Cobrar** → guarda venta, descuenta stock, limpia carrito

---

## 🔧 Administración

Click en "⚙️ Administración" (header) para:
- **Agregar productos** con precios diferenciados por tipo de cliente
- **Gestionar categorías**
- Ver stock en tiempo real

---

## 📱 PWA / Mobile

El diseño es responsive. Para instalar como app:
1. Chrome/Edge menú → "Instalar POS Yuselania"
2. Funciona offline (Firestore cache)

---

## 🚀 Deploy a Firebase Hosting

```bash
npm install -g firebase-tools
firebase login
firebase init hosting
# Seleccionar proyecto existente
# Public directory: .
# Single-page app: No
firebase deploy
```

---

## 📝 Próximos Pasos (Roadmap)

- [ ] **Clientes**: CRUD de clientes con tipo asignado
- [ ] **Ventas a crédito**: Cuentas por cobrar
- [ ] **Cierre de caja**: Arqueo diario
- [ ] **Reportes**: Ventas por día/mes, productos top, stock bajo
- [ ] **Impresión ticket**: ESC/POS para impresoras térmicas
- [ ] **Multi-sucursal**: Campo `branchId` en productos/ventas
- [ ] **Usuarios/Roles**: Admin, Cajero, Encargado stock
- [ ] **Backup automático**: Cloud Functions scheduled export

---

## 🐛 Troubleshooting

| Error | Solución |
|-------|----------|
| `permission-denied` | Verificar `firestore.rules` publicado y usuario logueado |
| `offline` | Firestore cache automático; recargar al volver online |
| `stock negativo` | Transacción atómica en `completeSale()` usa batch write |
| `precios no actualizan` | Cambiar `customerType` recalcula carrito automáticamente |

---

## 📄 Licencia

MIT - Úsalo libremente para tu negocio.