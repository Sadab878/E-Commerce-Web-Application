# 🛍️ ShopEase — Full Stack E-Commerce App

> Java Spring Boot + React + MySQL + Razorpay Payment Gateway

---

## 📁 Project Structure

```
ecommerce/
├── ecommerce-backend/          # Spring Boot API
│   ├── pom.xml
│   ├── schema.sql              # MySQL schema + sample data
│   └── src/main/java/com/ecommerce/
│       ├── EcommerceApplication.java
│       ├── entity/             (User, Product, Order, OrderItem, CartItem)
│       ├── repository/         (JPA Repositories)
│       ├── service/            (AuthService, ProductService, CartService, PaymentService)
│       ├── controller/         (AuthController, ProductController, CartController, PaymentController)
│       └── security/           (JwtUtil, JwtAuthFilter, SecurityConfig)
│
└── ecommerce-frontend/         # React App
    ├── index.html              (includes Razorpay SDK script)
    └── src/
        └── App.jsx             (Full single-file React app)
```

---

## ⚙️ Setup Instructions

### 1. MySQL Setup

```bash
# Login to MySQL
mysql -u root -p

# Run the schema file
source /path/to/ecommerce-backend/schema.sql
```

### 2. Backend Setup

**Edit `src/main/resources/application.properties`:**

```properties
# Your MySQL password
spring.datasource.password=YOUR_MYSQL_PASSWORD

# Your Razorpay keys (from https://dashboard.razorpay.com)
razorpay.key.id=rzp_test_YOUR_KEY_ID
razorpay.key.secret=YOUR_KEY_SECRET

# JWT Secret (change to any random 32+ char string)
app.jwt.secret=your_super_secret_key_here_32_chars_minimum
```

**Run the backend:**
```bash
cd ecommerce-backend
mvn spring-boot:run
```
> API runs on http://localhost:8080

### 3. Frontend Setup

```bash
# Create React app (if not already)
npm create vite@latest ecommerce-frontend -- --template react
cd ecommerce-frontend

# Copy the provided App.jsx and index.html
# Then install & run:
npm install
npm run dev
```
> Frontend runs on http://localhost:3000

---

## 🔑 Get Razorpay Test Keys

1. Sign up at https://dashboard.razorpay.com
2. Go to **Settings → API Keys**
3. Generate Test Keys
4. Copy `Key ID` and `Key Secret` into `application.properties`

**Test Card Numbers:**
| Card | Number | CVV | Expiry |
|------|--------|-----|--------|
| Visa | 4111 1111 1111 1111 | Any 3 digits | Any future date |

**Test UPI:** `success@razorpay`

---

## 🛠️ API Endpoints

### Auth
| Method | URL | Description |
|--------|-----|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login, get JWT token |

### Products
| Method | URL | Auth | Description |
|--------|-----|------|-------------|
| GET | `/api/products` | Public | List all products |
| GET | `/api/products/{id}` | Public | Get single product |
| GET | `/api/products/search?q=term` | Public | Search products |
| POST | `/api/products` | Admin | Create product |
| PUT | `/api/products/{id}` | Admin | Update product |
| DELETE | `/api/products/{id}` | Admin | Delete product |

### Cart
| Method | URL | Auth | Description |
|--------|-----|------|-------------|
| GET | `/api/cart` | User | Get cart |
| POST | `/api/cart/add` | User | Add item |
| PUT | `/api/cart/{id}` | User | Update quantity |
| DELETE | `/api/cart/{id}` | User | Remove item |

### Payment (Razorpay)
| Method | URL | Auth | Description |
|--------|-----|------|-------------|
| POST | `/api/payment/create-order` | User | Create Razorpay order |
| POST | `/api/payment/verify` | User | Verify payment signature |
| GET | `/api/payment/my-orders` | User | Get order history |

---

## 💳 Razorpay Payment Flow

```
1. User clicks "Pay" on Checkout page
        ↓
2. POST /api/payment/create-order
   → Spring Boot creates Razorpay order (via Razorpay Java SDK)
   → Saves Order in MySQL with status PAYMENT_INITIATED
   → Returns: { razorpayOrderId, amount, keyId, ... }
        ↓
3. React opens Razorpay Checkout popup
   (using window.Razorpay with the order details)
        ↓
4. User completes payment on Razorpay
        ↓
5. Razorpay calls handler with:
   { razorpay_order_id, razorpay_payment_id, razorpay_signature }
        ↓
6. POST /api/payment/verify
   → Spring Boot verifies HMAC-SHA256 signature
   → Updates Order status to PAID
   → Clears user's cart
   → Returns success
```

---

## 🔐 Default Admin Account

```
Email:    admin@shopease.com
Password: admin123
```

---

## 🚀 Quick Test

```bash
# Register a user
curl -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"John","email":"john@test.com","password":"pass123","phone":"9999999999"}'

# Login
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"john@test.com","password":"pass123"}'

# Get products
curl http://localhost:8080/api/products
```
