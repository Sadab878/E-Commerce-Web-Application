-- ============================================
-- E-Commerce Database Schema
-- Run this in MySQL before starting the app
-- OR let Spring Boot (ddl-auto=update) auto-create
-- ============================================

CREATE DATABASE IF NOT EXISTS ecommerce_db;
USE ecommerce_db;

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    phone VARCHAR(15),
    role ENUM('USER', 'ADMIN') DEFAULT 'USER',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Products Table
CREATE TABLE IF NOT EXISTS products (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    stock INT NOT NULL DEFAULT 0,
    image_url VARCHAR(500),
    category VARCHAR(100),
    active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Cart Items Table
CREATE TABLE IF NOT EXISTS cart_items (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    product_id BIGINT NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_product (user_id, product_id)
);

-- Orders Table
CREATE TABLE IF NOT EXISTS orders (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    total_amount DECIMAL(10, 2) NOT NULL,
    status ENUM('PENDING','PAYMENT_INITIATED','PAID','PROCESSING','SHIPPED','DELIVERED','CANCELLED','REFUNDED') DEFAULT 'PENDING',
    razorpay_order_id VARCHAR(100),
    razorpay_payment_id VARCHAR(100),
    razorpay_signature VARCHAR(300),
    shipping_address TEXT,
    shipping_city VARCHAR(100),
    shipping_state VARCHAR(100),
    shipping_pincode VARCHAR(10),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Order Items Table
CREATE TABLE IF NOT EXISTS order_items (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    order_id BIGINT NOT NULL,
    product_id BIGINT NOT NULL,
    quantity INT NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id)
);

-- ─── Sample Data ────────────────────────────────────────────────
-- Admin user (password: admin123 - BCrypt encoded)
INSERT INTO users (name, email, password, role) VALUES
('Admin', 'admin@shopease.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lh', 'ADMIN');

-- Sample Products
INSERT INTO products (name, description, price, stock, category, image_url) VALUES
('iPhone 15 Pro', 'Latest Apple iPhone with A17 Pro chip, titanium design, and 48MP camera system.', 134900.00, 50, 'Electronics', 'https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=500'),
('Sony WH-1000XM5', 'Industry-leading noise canceling wireless headphones with 30hr battery life.', 26990.00, 30, 'Electronics', 'https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?w=500'),
('Nike Air Max 270', 'Lightweight and comfortable sneakers with Max Air cushioning unit.', 10995.00, 100, 'Fashion', 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=500'),
('Minimalist Watch', 'Elegant stainless steel watch with sapphire crystal glass and leather strap.', 8499.00, 40, 'Accessories', 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500'),
('MacBook Air M2', 'Apple MacBook Air with M2 chip, 8GB RAM, 256GB SSD. Incredibly thin and light.', 114900.00, 20, 'Electronics', 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=500'),
('Premium Backpack', 'Water-resistant 30L backpack with laptop compartment and USB charging port.', 3499.00, 75, 'Accessories', 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=500');
