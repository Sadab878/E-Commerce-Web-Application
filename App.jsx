import { useState, useEffect, createContext, useContext } from "react";

// ─── Auth Context ───────────────────────────────────────────────
const AuthContext = createContext(null);
const useAuth = () => useContext(AuthContext);

const API = "http://localhost:8080/api";

const api = async (path, options = {}) => {
  const token = localStorage.getItem("token");
  const res = await fetch(`${API}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Something went wrong");
  return data;
};

// ─── Razorpay Payment Handler ───────────────────────────────────
const initiateRazorpayPayment = (orderData, onSuccess, onFailure) => {
  const options = {
    key: orderData.keyId,
    amount: orderData.amount,
    currency: orderData.currency,
    name: "ShopEase",
    description: "Order Payment",
    order_id: orderData.razorpayOrderId,
    prefill: {
      name: orderData.name,
      email: orderData.email,
      contact: orderData.phone,
    },
    theme: { color: "#E85D26" },
    handler: async (response) => {
      try {
        const result = await api("/payment/verify", {
          method: "POST",
          body: JSON.stringify({
            razorpayOrderId: response.razorpay_order_id,
            razorpayPaymentId: response.razorpay_payment_id,
            razorpaySignature: response.razorpay_signature,
          }),
        });
        onSuccess(result);
      } catch (e) {
        onFailure(e.message);
      }
    },
    modal: { ondismiss: () => onFailure("Payment cancelled") },
  };
  const rzp = new window.Razorpay(options);
  rzp.open();
};

// ─── Components ─────────────────────────────────────────────────

function Navbar({ page, setPage, cartCount }) {
  const { user, logout } = useAuth();
  return (
    <nav style={styles.nav}>
      <div style={styles.navBrand} onClick={() => setPage("home")}>
        🛍️ ShopEase
      </div>
      <div style={styles.navLinks}>
        <button style={styles.navBtn} onClick={() => setPage("home")}>Products</button>
        {user && (
          <>
            <button style={styles.navBtn} onClick={() => setPage("cart")}>
              🛒 Cart {cartCount > 0 && <span style={styles.badge}>{cartCount}</span>}
            </button>
            <button style={styles.navBtn} onClick={() => setPage("orders")}>My Orders</button>
          </>
        )}
        {user ? (
          <button style={{ ...styles.navBtn, ...styles.navBtnPrimary }} onClick={logout}>
            Logout ({user.name})
          </button>
        ) : (
          <button style={{ ...styles.navBtn, ...styles.navBtnPrimary }} onClick={() => setPage("login")}>
            Login / Register
          </button>
        )}
      </div>
    </nav>
  );
}

function ProductCard({ product, onAddToCart }) {
  return (
    <div style={styles.card}>
      <img
        src={product.imageUrl || "https://via.placeholder.com/300x200?text=Product"}
        alt={product.name}
        style={styles.cardImg}
      />
      <div style={styles.cardBody}>
        <span style={styles.categoryTag}>{product.category}</span>
        <h3 style={styles.cardTitle}>{product.name}</h3>
        <p style={styles.cardDesc}>{product.description?.slice(0, 80)}...</p>
        <div style={styles.cardFooter}>
          <span style={styles.price}>₹{product.price?.toLocaleString("en-IN")}</span>
          <button style={styles.btnPrimary} onClick={() => onAddToCart(product)}>
            Add to Cart
          </button>
        </div>
      </div>
    </div>
  );
}

function ProductsPage({ setPage, setCart, showToast }) {
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    api("/products").then(setProducts).finally(() => setLoading(false));
  }, []);

  const filtered = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.category?.toLowerCase().includes(search.toLowerCase())
  );

  const addToCart = async (product) => {
    if (!user) { setPage("login"); return; }
    try {
      await api("/cart/add", {
        method: "POST",
        body: JSON.stringify({ productId: product.id, quantity: 1 }),
      });
      const cart = await api("/cart");
      setCart(cart);
      showToast("Added to cart! 🛒");
    } catch (e) {
      showToast(e.message, "error");
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.hero}>
        <h1 style={styles.heroTitle}>Discover Amazing Products</h1>
        <p style={styles.heroSub}>Quality items at the best prices, delivered to your door</p>
        <input
          style={styles.searchInput}
          placeholder="Search products..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      {loading ? (
        <div style={styles.center}><div style={styles.spinner} /></div>
      ) : (
        <div style={styles.grid}>
          {filtered.map((p) => (
            <ProductCard key={p.id} product={p} onAddToCart={addToCart} />
          ))}
        </div>
      )}
    </div>
  );
}

function CartPage({ cart, setCart, setPage, showToast }) {
  const total = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

  const updateQty = async (itemId, qty) => {
    await api(`/cart/${itemId}`, { method: "PUT", body: JSON.stringify({ quantity: qty }) });
    const updated = await api("/cart");
    setCart(updated);
  };

  const remove = async (itemId) => {
    await api(`/cart/${itemId}`, { method: "DELETE" });
    const updated = await api("/cart");
    setCart(updated);
  };

  if (cart.length === 0)
    return (
      <div style={styles.emptyState}>
        <div style={{ fontSize: 64 }}>🛒</div>
        <h2>Your cart is empty</h2>
        <button style={styles.btnPrimary} onClick={() => setPage("home")}>Shop Now</button>
      </div>
    );

  return (
    <div style={styles.container}>
      <h2 style={styles.pageTitle}>Your Cart</h2>
      <div style={styles.cartLayout}>
        <div style={styles.cartItems}>
          {cart.map((item) => (
            <div key={item.id} style={styles.cartItem}>
              <img
                src={item.product.imageUrl || "https://via.placeholder.com/80"}
                alt={item.product.name}
                style={styles.cartItemImg}
              />
              <div style={{ flex: 1 }}>
                <div style={styles.cartItemName}>{item.product.name}</div>
                <div style={styles.cartItemPrice}>₹{item.product.price?.toLocaleString("en-IN")}</div>
              </div>
              <div style={styles.qtyControls}>
                <button style={styles.qtyBtn} onClick={() => updateQty(item.id, item.quantity - 1)}>−</button>
                <span style={styles.qtyValue}>{item.quantity}</span>
                <button style={styles.qtyBtn} onClick={() => updateQty(item.id, item.quantity + 1)}>+</button>
              </div>
              <div style={styles.cartItemTotal}>
                ₹{(item.product.price * item.quantity).toLocaleString("en-IN")}
              </div>
              <button style={styles.removeBtn} onClick={() => remove(item.id)}>✕</button>
            </div>
          ))}
        </div>
        <div style={styles.cartSummary}>
          <h3 style={styles.summaryTitle}>Order Summary</h3>
          <div style={styles.summaryRow}><span>Items ({cart.length})</span><span>₹{total.toLocaleString("en-IN")}</span></div>
          <div style={styles.summaryRow}><span>Shipping</span><span style={{ color: "#27ae60" }}>FREE</span></div>
          <div style={{ ...styles.summaryRow, borderTop: "2px solid #eee", paddingTop: 12, fontWeight: 700, fontSize: 18 }}>
            <span>Total</span><span>₹{total.toLocaleString("en-IN")}</span>
          </div>
          <button style={{ ...styles.btnPrimary, width: "100%", marginTop: 16, padding: "14px" }}
            onClick={() => setPage("checkout")}>
            Proceed to Checkout →
          </button>
        </div>
      </div>
    </div>
  );
}

function CheckoutPage({ cart, setCart, setPage, showToast }) {
  const [form, setForm] = useState({ address: "", city: "", state: "", pincode: "" });
  const [loading, setLoading] = useState(false);
  const total = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

  const handlePay = async () => {
    if (!form.address || !form.city || !form.state || !form.pincode) {
      showToast("Please fill all shipping details", "error");
      return;
    }
    setLoading(true);
    try {
      const orderData = await api("/payment/create-order", {
        method: "POST",
        body: JSON.stringify(form),
      });

      initiateRazorpayPayment(
        orderData,
        (result) => {
          showToast("🎉 Payment successful! Order placed.");
          setCart([]);
          setPage("orders");
        },
        (err) => {
          showToast(err, "error");
          setLoading(false);
        }
      );
    } catch (e) {
      showToast(e.message, "error");
    }
    setLoading(false);
  };

  return (
    <div style={styles.container}>
      <h2 style={styles.pageTitle}>Checkout</h2>
      <div style={styles.checkoutLayout}>
        <div style={styles.formSection}>
          <h3 style={styles.sectionTitle}>Shipping Address</h3>
          {["address", "city", "state", "pincode"].map((field) => (
            <input
              key={field}
              style={styles.input}
              placeholder={field.charAt(0).toUpperCase() + field.slice(1)}
              value={form[field]}
              onChange={(e) => setForm({ ...form, [field]: e.target.value })}
            />
          ))}

          <h3 style={styles.sectionTitle}>Order Summary</h3>
          {cart.map((item) => (
            <div key={item.id} style={styles.checkoutItem}>
              <span>{item.product.name} × {item.quantity}</span>
              <span>₹{(item.product.price * item.quantity).toLocaleString("en-IN")}</span>
            </div>
          ))}
          <div style={{ ...styles.checkoutItem, fontWeight: 700, fontSize: 18, borderTop: "2px solid #eee", paddingTop: 12 }}>
            <span>Total</span>
            <span>₹{total.toLocaleString("en-IN")}</span>
          </div>

          <div style={styles.razorpayInfo}>
            <img src="https://razorpay.com/favicon.ico" width={20} alt="" />
            Secured by Razorpay — All major UPI, Cards, Net Banking accepted
          </div>

          <button style={{ ...styles.btnPrimary, width: "100%", padding: "16px", fontSize: 16 }}
            onClick={handlePay} disabled={loading}>
            {loading ? "Processing..." : `Pay ₹${total.toLocaleString("en-IN")} with Razorpay`}
          </button>
        </div>
      </div>
    </div>
  );
}

function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api("/payment/my-orders").then(setOrders).finally(() => setLoading(false));
  }, []);

  const statusColors = {
    PENDING: "#f39c12", PAYMENT_INITIATED: "#3498db", PAID: "#27ae60",
    PROCESSING: "#2980b9", SHIPPED: "#8e44ad", DELIVERED: "#27ae60",
    CANCELLED: "#e74c3c", REFUNDED: "#95a5a6",
  };

  if (loading) return <div style={styles.center}><div style={styles.spinner} /></div>;
  if (orders.length === 0)
    return <div style={styles.emptyState}><div style={{ fontSize: 64 }}>📦</div><h2>No orders yet</h2></div>;

  return (
    <div style={styles.container}>
      <h2 style={styles.pageTitle}>My Orders</h2>
      {orders.map((order) => (
        <div key={order.id} style={styles.orderCard}>
          <div style={styles.orderHeader}>
            <div>
              <div style={styles.orderId}>Order #{order.id}</div>
              <div style={styles.orderDate}>{new Date(order.createdAt).toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" })}</div>
            </div>
            <div>
              <span style={{ ...styles.statusBadge, background: statusColors[order.status] || "#999" }}>
                {order.status}
              </span>
              <div style={styles.orderTotal}>₹{order.totalAmount?.toLocaleString("en-IN")}</div>
            </div>
          </div>
          <div style={styles.orderItems}>
            {order.orderItems?.map((item) => (
              <div key={item.id} style={styles.orderItem}>
                <span>{item.product?.name}</span>
                <span>× {item.quantity}</span>
                <span>₹{(item.price * item.quantity).toLocaleString("en-IN")}</span>
              </div>
            ))}
          </div>
          {order.razorpayPaymentId && (
            <div style={styles.paymentId}>Payment ID: {order.razorpayPaymentId}</div>
          )}
        </div>
      ))}
    </div>
  );
}

function AuthPage({ setPage, showToast }) {
  const { login } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [form, setForm] = useState({ name: "", email: "", password: "", phone: "" });
  const [loading, setLoading] = useState(false);

  const handle = async () => {
    setLoading(true);
    try {
      const endpoint = isLogin ? "/auth/login" : "/auth/register";
      const data = await api(endpoint, { method: "POST", body: JSON.stringify(form) });
      login(data);
      setPage("home");
      showToast(`Welcome, ${data.name}! 👋`);
    } catch (e) {
      showToast(e.message, "error");
    }
    setLoading(false);
  };

  return (
    <div style={styles.authPage}>
      <div style={styles.authCard}>
        <div style={styles.authLogo}>🛍️ ShopEase</div>
        <h2 style={styles.authTitle}>{isLogin ? "Welcome Back" : "Create Account"}</h2>
        {!isLogin && (
          <>
            <input style={styles.input} placeholder="Full Name" value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input style={styles.input} placeholder="Phone Number" value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </>
        )}
        <input style={styles.input} type="email" placeholder="Email" value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <input style={styles.input} type="password" placeholder="Password" value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })} />
        <button style={{ ...styles.btnPrimary, width: "100%", padding: "14px" }}
          onClick={handle} disabled={loading}>
          {loading ? "Please wait..." : isLogin ? "Login" : "Register"}
        </button>
        <p style={styles.authSwitch}>
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <span style={styles.link} onClick={() => setIsLogin(!isLogin)}>
            {isLogin ? "Register" : "Login"}
          </span>
        </p>
      </div>
    </div>
  );
}

function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div style={{ ...styles.toast, background: toast.type === "error" ? "#e74c3c" : "#27ae60" }}>
      {toast.msg}
    </div>
  );
}

// ─── Main App ────────────────────────────────────────────────────
export default function App() {
  const [page, setPage] = useState("home");
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem("user");
    return stored ? JSON.parse(stored) : null;
  });
  const [cart, setCart] = useState([]);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    if (user) {
      api("/cart").then(setCart).catch(() => {});
    }
  }, [user]);

  const login = (data) => {
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data));
    setUser(data);
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
    setCart([]);
    setPage("home");
  };

  const pages = {
    home: <ProductsPage setPage={setPage} setCart={setCart} showToast={showToast} />,
    cart: <CartPage cart={cart} setCart={setCart} setPage={setPage} showToast={showToast} />,
    checkout: <CheckoutPage cart={cart} setCart={setCart} setPage={setPage} showToast={showToast} />,
    orders: <OrdersPage />,
    login: <AuthPage setPage={setPage} showToast={showToast} />,
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      <div style={styles.app}>
        <Navbar page={page} setPage={setPage} cartCount={cart.length} />
        <main>{pages[page] || pages.home}</main>
        <Toast toast={toast} />
      </div>
    </AuthContext.Provider>
  );
}

// ─── Styles ──────────────────────────────────────────────────────
const styles = {
  app: { fontFamily: "'Segoe UI', sans-serif", minHeight: "100vh", background: "#f8f9fa" },
  nav: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 32px", height: 64, background: "#1a1a2e", color: "#fff", position: "sticky", top: 0, zIndex: 100, boxShadow: "0 2px 12px rgba(0,0,0,0.3)" },
  navBrand: { fontSize: 22, fontWeight: 700, cursor: "pointer", color: "#E85D26" },
  navLinks: { display: "flex", gap: 8, alignItems: "center" },
  navBtn: { background: "none", border: "none", color: "#fff", cursor: "pointer", padding: "8px 14px", borderRadius: 6, fontSize: 14, position: "relative" },
  navBtnPrimary: { background: "#E85D26", borderRadius: 6 },
  badge: { background: "#e74c3c", color: "#fff", borderRadius: 10, padding: "2px 6px", fontSize: 11, marginLeft: 4 },
  container: { maxWidth: 1200, margin: "0 auto", padding: "32px 24px" },
  hero: { textAlign: "center", padding: "48px 24px 32px", background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)", color: "#fff", marginBottom: 40, borderRadius: 16 },
  heroTitle: { fontSize: 42, fontWeight: 800, marginBottom: 12, color: "#fff" },
  heroSub: { fontSize: 18, color: "#aaa", marginBottom: 24 },
  searchInput: { padding: "12px 24px", borderRadius: 30, border: "none", fontSize: 16, width: "min(500px, 100%)", outline: "none", background: "rgba(255,255,255,0.9)" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(270px, 1fr))", gap: 24 },
  card: { background: "#fff", borderRadius: 12, overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.08)", transition: "transform 0.2s, box-shadow 0.2s", cursor: "default" },
  cardImg: { width: "100%", height: 200, objectFit: "cover" },
  cardBody: { padding: 20 },
  categoryTag: { background: "#fff3e0", color: "#E85D26", borderRadius: 20, padding: "3px 10px", fontSize: 12, fontWeight: 600 },
  cardTitle: { fontSize: 18, fontWeight: 700, margin: "10px 0 8px", color: "#1a1a2e" },
  cardDesc: { color: "#666", fontSize: 14, lineHeight: 1.5, marginBottom: 16 },
  cardFooter: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  price: { fontSize: 20, fontWeight: 800, color: "#E85D26" },
  btnPrimary: { background: "#E85D26", color: "#fff", border: "none", borderRadius: 8, padding: "10px 18px", fontWeight: 600, cursor: "pointer", fontSize: 14, transition: "background 0.2s" },
  cartLayout: { display: "grid", gridTemplateColumns: "1fr 340px", gap: 32, alignItems: "start" },
  cartItems: { display: "flex", flexDirection: "column", gap: 16 },
  cartItem: { display: "flex", alignItems: "center", gap: 16, background: "#fff", padding: 16, borderRadius: 12, boxShadow: "0 1px 8px rgba(0,0,0,0.07)" },
  cartItemImg: { width: 72, height: 72, objectFit: "cover", borderRadius: 8 },
  cartItemName: { fontWeight: 600, marginBottom: 4 },
  cartItemPrice: { color: "#888", fontSize: 14 },
  cartItemTotal: { fontWeight: 700, fontSize: 18, minWidth: 80, textAlign: "right" },
  qtyControls: { display: "flex", alignItems: "center", gap: 8 },
  qtyBtn: { width: 32, height: 32, borderRadius: "50%", border: "2px solid #E85D26", background: "none", color: "#E85D26", fontWeight: 700, cursor: "pointer", fontSize: 18 },
  qtyValue: { fontWeight: 700, fontSize: 16, minWidth: 24, textAlign: "center" },
  removeBtn: { background: "none", border: "none", color: "#ccc", cursor: "pointer", fontSize: 18, padding: "4px 8px" },
  cartSummary: { background: "#fff", borderRadius: 12, padding: 24, boxShadow: "0 2px 12px rgba(0,0,0,0.08)", position: "sticky", top: 80 },
  summaryTitle: { fontWeight: 700, fontSize: 20, marginBottom: 20 },
  summaryRow: { display: "flex", justifyContent: "space-between", marginBottom: 12, color: "#555" },
  checkoutLayout: { maxWidth: 640, margin: "0 auto" },
  formSection: { background: "#fff", padding: 32, borderRadius: 16, boxShadow: "0 2px 16px rgba(0,0,0,0.08)" },
  sectionTitle: { fontWeight: 700, fontSize: 18, margin: "24px 0 16px" },
  input: { width: "100%", padding: "12px 16px", border: "2px solid #eee", borderRadius: 8, fontSize: 15, marginBottom: 12, outline: "none", boxSizing: "border-box", transition: "border-color 0.2s" },
  checkoutItem: { display: "flex", justifyContent: "space-between", padding: "8px 0", color: "#555", borderBottom: "1px solid #f0f0f0" },
  razorpayInfo: { display: "flex", alignItems: "center", gap: 8, color: "#888", fontSize: 13, margin: "16px 0", padding: "12px", background: "#f8f9fa", borderRadius: 8 },
  orderCard: { background: "#fff", borderRadius: 12, padding: 24, marginBottom: 20, boxShadow: "0 2px 12px rgba(0,0,0,0.07)" },
  orderHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 },
  orderId: { fontWeight: 700, fontSize: 18 },
  orderDate: { color: "#888", fontSize: 13, marginTop: 4 },
  statusBadge: { color: "#fff", borderRadius: 20, padding: "4px 12px", fontSize: 13, fontWeight: 600 },
  orderTotal: { fontWeight: 700, fontSize: 20, color: "#E85D26", marginTop: 8, textAlign: "right" },
  orderItems: { borderTop: "1px solid #f0f0f0", paddingTop: 12 },
  orderItem: { display: "flex", gap: 16, justifyContent: "space-between", padding: "6px 0", color: "#555" },
  paymentId: { marginTop: 12, fontSize: 12, color: "#aaa", fontFamily: "monospace" },
  authPage: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)" },
  authCard: { background: "#fff", borderRadius: 20, padding: 40, width: "min(420px, 90vw)", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" },
  authLogo: { textAlign: "center", fontSize: 28, fontWeight: 800, color: "#E85D26", marginBottom: 8 },
  authTitle: { textAlign: "center", fontWeight: 700, fontSize: 24, margin: "0 0 24px", color: "#1a1a2e" },
  authSwitch: { textAlign: "center", color: "#888", marginTop: 20, fontSize: 14 },
  link: { color: "#E85D26", cursor: "pointer", fontWeight: 600 },
  pageTitle: { fontWeight: 800, fontSize: 28, color: "#1a1a2e", marginBottom: 32 },
  emptyState: { textAlign: "center", padding: "80px 24px", color: "#888" },
  center: { display: "flex", justifyContent: "center", padding: 80 },
  spinner: { width: 48, height: 48, border: "4px solid #eee", borderTop: "4px solid #E85D26", borderRadius: "50%", animation: "spin 0.8s linear infinite" },
  toast: { position: "fixed", bottom: 32, right: 32, color: "#fff", padding: "14px 24px", borderRadius: 12, fontWeight: 600, boxShadow: "0 4px 20px rgba(0,0,0,0.3)", zIndex: 9999, animation: "slideUp 0.3s ease" },
};
