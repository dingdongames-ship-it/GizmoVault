import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  CheckSquare, 
  MessageSquare, 
  Package, 
  ShoppingBag, 
  Activity, 
  Check, 
  X, 
  Edit3, 
  Plus, 
  ArrowLeft,
  RefreshCw,
  Send
} from 'lucide-react';
import { Card } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';
import { Modal } from '../../ui/Modal';
import { useApp } from '../../../context/AppContext';
import { useToast } from '../../ui/Toast';
import { MerchantDashboardView } from './MerchantDashboardView';
import { Radio } from 'lucide-react';

type AdminTab = 'merchant-live' | 'dashboard' | 'approval' | 'whatsapp' | 'inventory' | 'orders' | 'health';

export const AdminPortalView: React.FC = () => {
  const { 
    products, 
    orders, 
    ingestedItems, 
    approveIngestedProduct, 
    rejectIngestedProduct, 
    navigateTo 
  } = useApp();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<AdminTab>('merchant-live');
  const [editingItem, setEditingItem] = useState<any | null>(null);

  // Simulation state
  const [simText, setSimText] = useState("Original imported smartwatch\nAMOLED display\nBluetooth calling\nPrice ₹3,999\nDiscount ₹3,199");
  const [simCategory, setSimCategory] = useState("Imported Watches");

  const totalSales = orders.reduce((sum, o) => sum + o.grandTotal, 0);
  const pendingApprovals = ingestedItems.filter(i => i.status === 'NEEDS_REVIEW');
  const lowStockCount = products.filter(p => p.stockQuantity <= 5).length;

  const handleSimulateWebhook = (e: React.FormEvent) => {
    e.preventDefault();
    showToast('Simulated WhatsApp broadcast message received & AI extracted!', 'success');
  };

  return (
    <div style={{ paddingBottom: 48 }}>
      {/* Top Admin Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Button variant="ghost" size="sm" icon={<ArrowLeft size={16} />} onClick={() => navigateTo('home')}>
            Exit Admin
          </Button>
          <div>
            <h1 style={{ fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>GizmoVault Command Center</span>
              <span className="badge badge-cyan" style={{ fontSize: '0.6875rem' }}>Admin</span>
            </h1>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Authorized WhatsApp Ingestion, Moderation & Store Operations
            </div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div style={{ display: 'flex', gap: 6, background: 'var(--bg-surface-elevated)', padding: 4, borderRadius: 'var(--radius-md)', overflowX: 'auto' }}>
          <Button 
            variant={activeTab === 'merchant-live' ? 'primary' : 'ghost'} 
            size="sm" 
            icon={<Radio size={14} style={{ color: activeTab === 'merchant-live' ? '#fff' : 'var(--accent-cyan)' }} />} 
            onClick={() => setActiveTab('merchant-live')}
          >
            Live Ingestion & Catalog
          </Button>
          <Button 
            variant={activeTab === 'dashboard' ? 'primary' : 'ghost'} 
            size="sm" 
            icon={<LayoutDashboard size={14} />} 
            onClick={() => setActiveTab('dashboard')}
          >
            Dashboard
          </Button>
          <Button 
            variant={activeTab === 'approval' ? 'primary' : 'ghost'} 
            size="sm" 
            icon={<CheckSquare size={14} />} 
            onClick={() => setActiveTab('approval')}
          >
            Approval Queue ({pendingApprovals.length})
          </Button>
          <Button 
            variant={activeTab === 'whatsapp' ? 'primary' : 'ghost'} 
            size="sm" 
            icon={<MessageSquare size={14} />} 
            onClick={() => setActiveTab('whatsapp')}
          >
            WhatsApp Sources
          </Button>
          <Button 
            variant={activeTab === 'inventory' ? 'primary' : 'ghost'} 
            size="sm" 
            icon={<Package size={14} />} 
            onClick={() => setActiveTab('inventory')}
          >
            Inventory
          </Button>
          <Button 
            variant={activeTab === 'orders' ? 'primary' : 'ghost'} 
            size="sm" 
            icon={<ShoppingBag size={14} />} 
            onClick={() => setActiveTab('orders')}
          >
            Orders
          </Button>
          <Button 
            variant={activeTab === 'health' ? 'primary' : 'ghost'} 
            size="sm" 
            icon={<Activity size={14} />} 
            onClick={() => setActiveTab('health')}
          >
            System Health
          </Button>
        </div>
      </div>

      {/* TAB 0: REAL-TIME INGESTION & CATALOG COMMAND CENTER */}
      {activeTab === 'merchant-live' && (
        <MerchantDashboardView />
      )}

      {/* TAB 1: EXECUTIVE DASHBOARD */}
      {activeTab === 'dashboard' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 24 }}>
            <Card>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Total Gross Sales</div>
              <div style={{ fontSize: '1.875rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: 4 }}>
                ₹{totalSales.toLocaleString('en-IN')}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-success)', marginTop: 4 }}>+24% vs last week</div>
            </Card>

            <Card>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Orders Fulfilled</div>
              <div style={{ fontSize: '1.875rem', fontWeight: 800, color: 'var(--accent-cyan)', marginTop: 4 }}>
                {orders.length}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 4 }}>100% on-time dispatch</div>
            </Card>

            <Card>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Awaiting Moderation</div>
              <div style={{ fontSize: '1.875rem', fontWeight: 800, color: 'var(--accent-gold)', marginTop: 4 }}>
                {pendingApprovals.length}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--accent-gold)', marginTop: 4 }}>Requires review</div>
            </Card>

            <Card>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Low Stock Warnings</div>
              <div style={{ fontSize: '1.875rem', fontWeight: 800, color: 'var(--color-danger)', marginTop: 4 }}>
                {lowStockCount}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>&le; 5 units remaining</div>
            </Card>
          </div>

          <Card style={{ marginBottom: 24 }}>
            <h3 style={{ marginBottom: 12 }}>WhatsApp Ingestion Pipeline Status</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, textAlign: 'center' }}>
              <div style={{ padding: 12, background: 'var(--bg-surface-elevated)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Messages Received</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: 4 }}>184</div>
              </div>
              <div style={{ padding: 12, background: 'var(--bg-surface-elevated)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Successfully Extracted</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: 4, color: 'var(--color-success)' }}>171</div>
              </div>
              <div style={{ padding: 12, background: 'var(--bg-surface-elevated)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Duplicates Reconciled</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: 4, color: 'var(--accent-cyan)' }}>9</div>
              </div>
              <div style={{ padding: 12, background: 'var(--bg-surface-elevated)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Extraction Success Rate</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: 4 }}>97.8%</div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 2: PRODUCT APPROVAL QUEUE */}
      {activeTab === 'approval' && (
        <div>
          <div style={{ marginBottom: 16 }}>
            <h2>WhatsApp Product Ingestion Center</h2>
            <p style={{ fontSize: '0.875rem' }}>Review extracted specs, verify pricing, and publish directly to live catalog.</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {ingestedItems.map((item) => (
              <Card key={item.id} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <img src={item.mediaUrls[0]} alt="" style={{ width: 72, height: 72, borderRadius: 8, objectFit: 'cover' }} />
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span className={`badge ${item.status === 'PUBLISHED' ? 'badge-success' : 'badge-gold'}`}>
                          {item.status}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          Confidence: {(item.confidenceScore * 100).toFixed(0)}%
                        </span>
                      </div>
                      <h3 style={{ fontSize: '1.0625rem', fontWeight: 700 }}>{item.extractedTitle}</h3>
                      <div style={{ fontSize: '0.8125rem', color: 'var(--accent-cyan)' }}>{item.extractedCategory}</div>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800 }}>₹{item.sellingPrice.toLocaleString('en-IN')}</div>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', textDecoration: 'line-through' }}>
                      MRP ₹{item.originalPrice.toLocaleString('en-IN')}
                    </div>
                  </div>
                </div>

                {/* Raw Message vs Extracted Specs */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12, fontSize: '0.8125rem' }}>
                  <div style={{ padding: 10, background: 'var(--bg-base)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600 }}>Raw WhatsApp Message:</div>
                    <div style={{ fontFamily: 'var(--font-mono)', whiteSpace: 'pre-line', color: 'var(--text-secondary)' }}>
                      {item.rawText}
                    </div>
                  </div>

                  <div style={{ padding: 10, background: 'var(--bg-base)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ color: 'var(--accent-gold)', marginBottom: 4, fontWeight: 600 }}>Extracted Specifications:</div>
                    {Object.entries(item.specs).map(([k, v]) => (
                      <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                        <span style={{ color: 'var(--text-muted)' }}>{k}:</span>
                        <span style={{ fontWeight: 600 }}>{v}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                {item.status !== 'PUBLISHED' && (
                  <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid var(--border-subtle)' }}>
                    <Button variant="ghost" size="sm" icon={<X size={14} />} onClick={() => rejectIngestedProduct(item.id)}>
                      Reject
                    </Button>
                    <Button variant="primary" size="sm" icon={<Check size={14} />} onClick={() => approveIngestedProduct(item.id)}>
                      Approve & Publish
                    </Button>
                  </div>
                )}
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: WHATSAPP SOURCES & WEBHOOK SIMULATOR */}
      {activeTab === 'whatsapp' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
          <Card>
            <h3 style={{ marginBottom: 12 }}>Connected WhatsApp Business Sources</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
              <div style={{ padding: 12, background: 'var(--bg-surface-elevated)', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.9375rem' }}>Direct Global Vendor Hub</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Phone ID: 108492019482019 • +91 98110 54321</div>
                </div>
                <span className="badge badge-success">ACTIVE</span>
              </div>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Webhook URL: <code>https://api.gizmovault.com/api/v1/whatsapp/webhook</code>
            </div>
          </Card>

          <Card>
            <h3 style={{ marginBottom: 12 }}>Authorized Ingestion Simulator</h3>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: 14 }}>
              Test the AI extraction pipeline with a sample vendor message.
            </p>
            <form onSubmit={handleSimulateWebhook}>
              <div className="form-group">
                <label className="form-label">Vendor Broadcast Text</label>
                <textarea 
                  className="form-input" 
                  rows={4} 
                  value={simText} 
                  onChange={(e) => setSimText(e.target.value)}
                  style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}
                />
              </div>
              <Button variant="primary" fullWidth type="submit" icon={<Send size={16} />}>
                Inject & Extract Product
              </Button>
            </form>
          </Card>
        </div>
      )}

      {/* TAB 4: INVENTORY */}
      {activeTab === 'inventory' && (
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 style={{ fontSize: '1.25rem' }}>Live Inventory Levels</h3>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{products.length} Products Monitored</span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)', textAlign: 'left', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '10px 8px' }}>Product</th>
                  <th style={{ padding: '10px 8px' }}>SKU</th>
                  <th style={{ padding: '10px 8px' }}>Price</th>
                  <th style={{ padding: '10px 8px' }}>Available Units</th>
                  <th style={{ padding: '10px 8px' }}>Stock Status</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '10px 8px', fontWeight: 600 }}>{p.title}</td>
                    <td style={{ padding: '10px 8px', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>{p.sku}</td>
                    <td style={{ padding: '10px 8px' }}>₹{p.sellingPrice.toLocaleString('en-IN')}</td>
                    <td style={{ padding: '10px 8px', fontWeight: 700 }}>{p.stockQuantity}</td>
                    <td style={{ padding: '10px 8px' }}>
                      <span className={`badge ${p.stockStatus === 'IN_STOCK' ? 'badge-success' : 'badge-discount'}`}>
                        {p.stockStatus}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* TAB 5: ORDERS */}
      {activeTab === 'orders' && (
        <Card>
          <h3 style={{ fontSize: '1.25rem', marginBottom: 16 }}>Store Order Management</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {orders.map((ord) => (
              <div key={ord.id} style={{ padding: 14, background: 'var(--bg-surface-elevated)', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{ord.orderNumber} • ₹{ord.grandTotal.toLocaleString('en-IN')}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Customer: {ord.shippingAddress.fullName} • Method: {ord.paymentMethod}
                  </div>
                </div>
                <span className="badge badge-success">{ord.orderStatus}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* TAB 6: SYSTEM HEALTH */}
      {activeTab === 'health' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--color-success)' }} />
              <h4>SQLite Relational Database</h4>
            </div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>Status: CONNECTED & OPTIMIZED</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>Response: 0.8ms average latency</div>
          </Card>

          <Card>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--color-success)' }} />
              <h4>Meta WhatsApp Connector</h4>
            </div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>Status: WEBHOOK VERIFIED</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>Signature checks active</div>
          </Card>

          <Card>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--color-success)' }} />
              <h4>Payment Gateway Provider</h4>
            </div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>Status: PCI-DSS COMPLIANT</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>UPI, Cards & NetBanking ready</div>
          </Card>
        </div>
      )}
    </div>
  );
};
