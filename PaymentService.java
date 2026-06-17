package com.ecommerce.service;

import com.ecommerce.entity.CartItem;
import com.ecommerce.entity.Order;
import com.ecommerce.entity.OrderItem;
import com.ecommerce.entity.User;
import com.ecommerce.repository.CartItemRepository;
import com.ecommerce.repository.OrderRepository;
import com.ecommerce.repository.UserRepository;
import com.razorpay.RazorpayClient;
import com.razorpay.RazorpayException;
import lombok.RequiredArgsConstructor;
import org.json.JSONObject;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.InvalidKeyException;
import java.security.NoSuchAlgorithmException;
import java.util.Formatter;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class PaymentService {

    private final UserRepository userRepository;
    private final OrderRepository orderRepository;
    private final CartItemRepository cartItemRepository;

    @Value("${razorpay.key.id}")
    private String razorpayKeyId;

    @Value("${razorpay.key.secret}")
    private String razorpayKeySecret;

    /**
     * STEP 1: Create Razorpay Order
     * Called when user clicks "Proceed to Pay"
     */
    @Transactional
    public Map<String, Object> createOrder(Map<String, Object> shippingDetails) throws RazorpayException {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        User user = userRepository.findByEmail(email).orElseThrow();

        // Get cart items
        List<CartItem> cartItems = cartItemRepository.findByUserId(user.getId());
        if (cartItems.isEmpty()) throw new RuntimeException("Cart is empty");

        // Calculate total
        BigDecimal total = cartItems.stream()
                .map(item -> item.getProduct().getPrice().multiply(BigDecimal.valueOf(item.getQuantity())))
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        // Create Razorpay order (amount in paise)
        RazorpayClient razorpayClient = new RazorpayClient(razorpayKeyId, razorpayKeySecret);
        JSONObject orderRequest = new JSONObject();
        orderRequest.put("amount", total.multiply(BigDecimal.valueOf(100)).intValue()); // paise
        orderRequest.put("currency", "INR");
        orderRequest.put("receipt", "order_rcptid_" + System.currentTimeMillis());

        com.razorpay.Order razorpayOrder = razorpayClient.orders.create(orderRequest);

        // Create local order record
        Order order = Order.builder()
                .user(user)
                .totalAmount(total)
                .status(Order.OrderStatus.PAYMENT_INITIATED)
                .razorpayOrderId(razorpayOrder.get("id"))
                .shippingAddress(shippingDetails.getOrDefault("address", "").toString())
                .shippingCity(shippingDetails.getOrDefault("city", "").toString())
                .shippingState(shippingDetails.getOrDefault("state", "").toString())
                .shippingPincode(shippingDetails.getOrDefault("pincode", "").toString())
                .build();

        // Add order items
        List<OrderItem> orderItems = cartItems.stream().map(cartItem -> OrderItem.builder()
                .order(order)
                .product(cartItem.getProduct())
                .quantity(cartItem.getQuantity())
                .price(cartItem.getProduct().getPrice())
                .build()).collect(Collectors.toList());
        order.setOrderItems(orderItems);
        orderRepository.save(order);

        return Map.of(
            "razorpayOrderId", razorpayOrder.get("id").toString(),
            "amount", total.multiply(BigDecimal.valueOf(100)).intValue(),
            "currency", "INR",
            "keyId", razorpayKeyId,
            "orderId", order.getId(),
            "name", user.getName(),
            "email", user.getEmail(),
            "phone", user.getPhone() != null ? user.getPhone() : ""
        );
    }

    /**
     * STEP 2: Verify Payment Signature
     * Called after Razorpay redirects back to your app
     */
    @Transactional
    public Map<String, Object> verifyPayment(Map<String, String> paymentData) {
        String razorpayOrderId   = paymentData.get("razorpayOrderId");
        String razorpayPaymentId = paymentData.get("razorpayPaymentId");
        String razorpaySignature = paymentData.get("razorpaySignature");

        // Verify signature
        String generatedSignature = generateSignature(razorpayOrderId + "|" + razorpayPaymentId, razorpayKeySecret);

        if (!generatedSignature.equals(razorpaySignature)) {
            throw new RuntimeException("Payment verification failed: Invalid signature");
        }

        // Update order status
        Order order = orderRepository.findByRazorpayOrderId(razorpayOrderId)
                .orElseThrow(() -> new RuntimeException("Order not found"));

        order.setRazorpayPaymentId(razorpayPaymentId);
        order.setRazorpaySignature(razorpaySignature);
        order.setStatus(Order.OrderStatus.PAID);
        orderRepository.save(order);

        // Clear cart
        cartItemRepository.deleteByUserId(order.getUser().getId());

        return Map.of(
            "success", true,
            "orderId", order.getId(),
            "message", "Payment successful! Order placed."
        );
    }

    private String generateSignature(String data, String secret) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] hash = mac.doFinal(data.getBytes(StandardCharsets.UTF_8));
            Formatter formatter = new Formatter();
            for (byte b : hash) formatter.format("%02x", b);
            return formatter.toString();
        } catch (NoSuchAlgorithmException | InvalidKeyException e) {
            throw new RuntimeException("Signature generation failed", e);
        }
    }

    public List<Order> getMyOrders() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        User user = userRepository.findByEmail(email).orElseThrow();
        return orderRepository.findByUserIdOrderByCreatedAtDesc(user.getId());
    }
}
