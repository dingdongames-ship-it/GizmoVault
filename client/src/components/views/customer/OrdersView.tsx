import React from 'react';
import { 
  Package, 
  Truck, 
  CheckCircle2, 
  Clock, 
  MapPin, 
  AlertCircle, 
  ArrowLeft, 
  RotateCcw 
} from 'lucide-react';
import { Card } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/Feedback';
import { useApp } from '../../../context/AppContext';
import { Order } from '../../../types';

export const OrdersView: React.FC = () => {
  const { 
    orders, 
    selectedOrder, 
    currentView, 
    navigateTo, 
    openOrderDetails, 
    openOrderTracking, 
    cancelOrder 
  } = useApp();

  if (orders.length === 0) {
    return (
      <EmptyState
        icon={<Package size={36} />}
        title="No orders placed yet"
        description="When you order imported watches or electronics, tracking numbers and invoices will appear here."
        actionText="Shop Now"
        onAction={() => navigateTo('home')}
      />
    );
  }

  // SUB-VIEW: ORDER TRACKING TIMELINE
  if (currentView === 'order-tracking' && selectedOrder) {
    const steps = [
      { label: 'Order Confirmed', time: 'Yesterday, 2:30 PM', done: true },
      { label: 'Verified & Packed at Vault Hub', time: 'Yesterday, 6:45 PM', done: true },
      { label: 'In Transit with Express Logistics', time: 'Today, 8:15 AM', done: selectedOrder.orderStatus === 'SHIPPED' || selectedOrder.orderStatus === 'OUT_FOR_DELIVERY' || selectedOrder.orderStatus === 'DELIVERED' },
      { label: 'Out for Doorstep Delivery', time: 'Expected by tomorrow', done: selectedOrder.orderStatus === 'OUT_FOR_DELIVERY' || selectedOrder.orderStatus === 'DELIVERED' },
      { label: 'Delivered', time: 'Estimated ' + selectedOrder.estimatedDelivery, done: selectedOrder.orderStatus === 'DELIVERED' }
    ];

    return (
      <div style={{ paddingBottom: 48 }}>
        <Button variant="ghost" size="sm" icon={<ArrowLeft size={16} />} onClick={() => navigateTo('orders')} style={{ marginBottom: 16 }}>
          Back to Orders
        </Button>

        <Card style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <span className="badge badge-cyan" style={{ marginBottom: 6 }}>Live Tracking</span>
              <h2 style={{ fontSize: '1.25rem' }}>{selectedOrder.orderNumber}</h2>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                Courier: Delhivery Express Air • AWB #{selectedOrder.trackingNumber}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Estimated Delivery</div>
              <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--accent-gold)' }}>
                {selectedOrder.estimatedDelivery}
              </div>
            </div>
          </div>

          {/* Timeline */}
          <div style={{ marginTop: 24, paddingLeft: 12, borderLeft: '2px solid var(--border-subtle)' }}>
            {steps.map((step, idx) => (
              <div key={idx} style={{ position: 'relative', paddingBottom: 24, paddingLeft: 20 }}>
                <div style={{
                  position: 'absolute',
                  left: -27,
                  top: 0,
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  background: step.done ? 'var(--accent-cyan)' : 'var(--bg-surface-elevated)',
                  border: '2px solid var(--bg-surface)',
                  boxShadow: step.done ? 'var(--cyan-glow)' : 'none'
                }} />
                <div style={{ fontWeight: step.done ? 700 : 500, color: step.done ? 'var(--text-primary)' : 'var(--text-muted)', fontSize: '0.9375rem' }}>
                  {step.label}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                  {step.time}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    );
  }

  // SUB-VIEW: ORDER DETAILS
  if (currentView === 'order-details' && selectedOrder) {
    return (
      <div style={{ paddingBottom: 48 }}>
        <Button variant="ghost" size="sm" icon={<ArrowLeft size={16} />} onClick={() => navigateTo('orders')} style={{ marginBottom: 16 }}>
          Back to Orders
        </Button>

        <Card style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <h2 style={{ fontSize: '1.375rem' }}>{selectedOrder.orderNumber}</h2>
                <span className="badge badge-success">{selectedOrder.orderStatus}</span>
              </div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                Placed on {new Date(selectedOrder.createdAt).toLocaleDateString()} via {selectedOrder.paymentMethod}
              </div>
            </div>

            <Button variant="primary" size="sm" icon={<Truck size={14} />} onClick={() => openOrderTracking(selectedOrder)}>
              Track Delivery
            </Button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
            {selectedOrder.items.map((item) => (
              <div key={item.product.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <img src={item.product.primaryImage} alt="" style={{ width: 56, height: 56, borderRadius: 8, objectFit: 'cover' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{item.product.title}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Quantity: {item.quantity} • SKU: {item.product.sku}</div>
                </div>
                <div style={{ fontWeight: 700, fontSize: '0.9375rem' }}>
                  ₹{(item.product.sellingPrice * item.quantity).toLocaleString('en-IN')}
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, fontSize: '0.875rem' }}>
            <div>
              <h4 style={{ color: 'var(--text-muted)', marginBottom: 6 }}>Delivery Address</h4>
              <div style={{ fontWeight: 600 }}>{selectedOrder.shippingAddress.fullName}</div>
              <div style={{ color: 'var(--text-secondary)' }}>{selectedOrder.shippingAddress.addressLine1}, {selectedOrder.shippingAddress.city} {selectedOrder.shippingAddress.postalCode}</div>
              <div style={{ color: 'var(--text-muted)' }}>Phone: {selectedOrder.shippingAddress.phone}</div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <h4 style={{ color: 'var(--text-muted)', marginBottom: 6 }}>Financial Breakdown</h4>
              <div>Subtotal: ₹{selectedOrder.subtotal.toLocaleString('en-IN')}</div>
              {selectedOrder.discount > 0 && <div style={{ color: 'var(--color-success)' }}>Discount: -₹{selectedOrder.discount.toLocaleString('en-IN')}</div>}
              <div style={{ fontWeight: 800, fontSize: '1.125rem', color: 'var(--accent-cyan)', marginTop: 4 }}>
                Total: ₹{selectedOrder.grandTotal.toLocaleString('en-IN')}
              </div>
            </div>
          </div>

          {selectedOrder.orderStatus !== 'CANCELLED' && (
            <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'flex-end' }}>
              <Button variant="danger" size="sm" icon={<RotateCcw size={14} />} onClick={() => cancelOrder(selectedOrder.id)}>
                Cancel Order & Refund
              </Button>
            </div>
          )}
        </Card>
      </div>
    );
  }

  // MAIN LIST VIEW: ORDERS
  return (
    <div style={{ paddingBottom: 48 }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: '1.75rem', marginBottom: 4 }}>Your Orders</h1>
        <p style={{ fontSize: '0.875rem' }}>Track, manage, and review order deliveries</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {orders.map((order) => (
          <Card key={order.id} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <h3 style={{ fontSize: '1.0625rem' }}>{order.orderNumber}</h3>
                  <span className={`badge ${order.orderStatus === 'CANCELLED' ? 'badge-discount' : 'badge-success'}`}>
                    {order.orderStatus}
                  </span>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                  {new Date(order.createdAt).toLocaleDateString()} • {order.items.length} item(s)
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '1.125rem', fontWeight: 800, color: 'var(--accent-cyan)' }}>
                  ₹{order.grandTotal.toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, alignItems: 'center', overflowX: 'auto', padding: '4px 0' }}>
              {order.items.map((it) => (
                <img key={it.product.id} src={it.product.primaryImage} alt="" style={{ width: 44, height: 44, borderRadius: 6, objectFit: 'cover' }} />
              ))}
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid var(--border-subtle)' }}>
              <Button variant="secondary" size="sm" onClick={() => openOrderDetails(order)}>
                Order Details
              </Button>
              <Button variant="primary" size="sm" icon={<Truck size={14} />} onClick={() => openOrderTracking(order)}>
                Track
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};
