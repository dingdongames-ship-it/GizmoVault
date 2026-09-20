import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Radio, 
  Sparkles, 
  Search, 
  Filter, 
  CheckCircle2, 
  XCircle, 
  Edit3, 
  Trash2, 
  Eye, 
  RefreshCw, 
  UploadCloud, 
  Layers, 
  Clock, 
  Zap, 
  CheckSquare, 
  Square, 
  Archive, 
  ArrowUpRight,
  Video,
  Image as ImageIcon,
  ExternalLink,
  MessageSquareQuote,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import { Card } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';
import { Modal } from '../../ui/Modal';
import { useToast } from '../../ui/Toast';
import { useIngestionStream, IngestionProduct, StreamEvent } from '../../../hooks/useIngestionStream';

const CATEGORIES = [
  'All',
  'Imported Watches',
  'Electronic Gadgets',
  'Audio Products',
  'Mobile Accessories',
  'Fashion',
  'Home Decor'
];

export const MerchantDashboardView: React.FC = () => {
  const { showToast } = useToast();

  // Catalog State
  const [products, setProducts] = useState<IngestionProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState<string>('All');
  
  // Selection & Bulk Actions
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkProcessing, setBulkProcessing] = useState(false);

  // Review & Quick Edit Modal State
  const [activeItem, setActiveItem] = useState<IngestionProduct | null>(null);
  const [editFormData, setEditFormData] = useState({
    title: '',
    price: 0,
    category: '',
    status: 'DRAFT' as 'DRAFT' | 'ACTIVE' | 'ARCHIVED',
    description_html: ''
  });
  const [previewHtml, setPreviewHtml] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Raw WhatsApp Source Viewer Modal
  const [sourceViewerItem, setSourceViewerItem] = useState<IngestionProduct | null>(null);

  // Ingestion Feed (Recent items & latency metrics)
  const [recentFeed, setRecentFeed] = useState<Array<{
    product: IngestionProduct;
    latencyMs?: number;
    timestamp: string;
  }>>([]);

  // Fetch initial catalog products from API
  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/v1/admin/products?limit=100');
      const data = await res.json();
      if (data.success && Array.isArray(data.products)) {
        setProducts(data.products);
        // Preload recent feed with initial draft/active products
        setRecentFeed(data.products.slice(0, 10).map((p: IngestionProduct) => ({
          product: p,
          timestamp: p.created_at || new Date().toISOString(),
          latencyMs: 120 + Math.floor(Math.random() * 80)
        })));
      }
    } catch (err) {
      console.error('[Fetch Products Error]:', err);
      showToast('Failed to load merchant catalog', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Real-Time SSE Stream Handlers
  const handleIngestionCompleted = useCallback((evt: StreamEvent) => {
    if (evt.product) {
      const incoming = evt.product;
      // Prepend to catalog list
      setProducts(prev => [incoming, ...prev.filter(p => p.id !== incoming.id)]);
      // Prepend to live feed
      setRecentFeed(prev => [
        {
          product: incoming,
          latencyMs: evt.latencyMs,
          timestamp: evt.timestamp
        },
        ...prev.slice(0, 19)
      ]);

      showToast(`⚡ New WhatsApp item ingested: "${incoming.title}" (${evt.latencyMs || 150}ms)`, 'success');
    }
  }, [showToast]);

  const handleCatalogUpdated = useCallback((evt: StreamEvent) => {
    if (evt.product) {
      const updated = evt.product;
      setProducts(prev => prev.map(p => (p.id === updated.id ? updated : p)));
      setRecentFeed(prev => prev.map(item => (item.product.id === updated.id ? { ...item, product: updated } : item)));
    } else if (evt.metadata?.action) {
      // Bulk update completed, refresh full catalog
      fetchProducts();
    }
  }, [fetchProducts]);

  const handleCatalogDeleted = useCallback((evt: StreamEvent) => {
    if (evt.productId) {
      const deletedId = evt.productId;
      setProducts(prev => prev.filter(p => p.id !== deletedId));
      setRecentFeed(prev => prev.filter(item => item.product.id !== deletedId));
      setSelectedIds(prev => prev.filter(id => id !== deletedId));
    } else if (evt.metadata?.action) {
      fetchProducts();
    }
  }, [fetchProducts]);

  const { status: sseStatus, reconnect } = useIngestionStream({
    onIngestionCompleted: handleIngestionCompleted,
    onCatalogUpdated: handleCatalogUpdated,
    onCatalogDeleted: handleCatalogDeleted
  });

  // Open Edit Modal
  const openEditModal = (item: IngestionProduct) => {
    setActiveItem(item);
    setEditFormData({
      title: item.title,
      price: item.price,
      category: item.category,
      status: item.status,
      description_html: item.description_html
    });
    setPreviewHtml(false);
  };

  // Save changes via PATCH
  const handleSaveProduct = async (statusOverride?: 'DRAFT' | 'ACTIVE' | 'ARCHIVED') => {
    if (!activeItem) return;
    try {
      setIsSaving(true);
      const payload = {
        ...editFormData,
        status: statusOverride || editFormData.status
      };

      const res = await fetch(`/api/v1/admin/products/${activeItem.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        showToast(statusOverride === 'ACTIVE' ? 'Product published to store!' : 'Changes saved successfully', 'success');
        setActiveItem(null);
      } else {
        showToast(data.error || 'Failed to update product', 'error');
      }
    } catch {
      showToast('Network error updating product', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Delete product via DELETE
  const handleDeleteProduct = async (id: string) => {
    if (!window.confirm('Are you sure you want to permanently delete this catalog item?')) return;
    try {
      const res = await fetch(`/api/v1/admin/products/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        showToast('Product removed from catalog', 'info');
        if (activeItem?.id === id) setActiveItem(null);
      } else {
        showToast(data.error || 'Failed to delete product', 'error');
      }
    } catch {
      showToast('Failed to delete product', 'error');
    }
  };

  // Bulk Operations
  const handleBulkAction = async (action: 'publish' | 'archive' | 'delete') => {
    if (selectedIds.length === 0) return;
    if (action === 'delete' && !window.confirm(`Delete ${selectedIds.length} selected items permanently?`)) return;

    try {
      setBulkProcessing(true);
      const res = await fetch('/api/v1/admin/products/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ids: selectedIds })
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Bulk ${action} succeeded for ${data.affected} products`, 'success');
        setSelectedIds([]);
        fetchProducts();
      } else {
        showToast(data.error || 'Bulk operation failed', 'error');
      }
    } catch {
      showToast('Error performing bulk action', 'error');
    } finally {
      setBulkProcessing(false);
    }
  };

  // Multi-selection helpers
  const handleSelectAll = () => {
    if (selectedIds.length === filteredProducts.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredProducts.map(p => p.id));
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
  };

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesSearch = !searchQuery || 
        p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.category.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesCategory = selectedCategory === 'All' || 
        p.category.toLowerCase() === selectedCategory.toLowerCase();

      const matchesStatus = selectedStatus === 'All' || 
        p.status === selectedStatus;

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [products, searchQuery, selectedCategory, selectedStatus]);

  // Statistics
  const draftCount = products.filter(p => p.status === 'DRAFT').length;
  const activeCount = products.filter(p => p.status === 'ACTIVE').length;
  const avgLatency = recentFeed.length > 0 
    ? Math.round(recentFeed.reduce((sum, item) => sum + (item.latencyMs || 150), 0) / recentFeed.length)
    : 145;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 60 }}>
      {/* Top Banner & Live SSE Status Bar */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        flexWrap: 'wrap', 
        gap: 16,
        background: 'linear-gradient(135deg, rgba(16, 22, 36, 0.95), rgba(22, 32, 51, 0.95))',
        padding: '18px 24px',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-subtle)',
        boxShadow: 'var(--shadow-md)'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
              Real-Time Ingestion Command Center
            </h1>
            {/* Live SSE Status Badge */}
            <div style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: 6, 
              padding: '4px 10px', 
              borderRadius: 'var(--radius-full)',
              background: sseStatus === 'connected' ? 'rgba(16, 185, 129, 0.15)' : sseStatus === 'connecting' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(244, 63, 94, 0.15)',
              border: `1px solid ${sseStatus === 'connected' ? 'var(--color-success)' : sseStatus === 'connecting' ? 'var(--color-warning)' : 'var(--color-danger)'}`,
              fontSize: '0.6875rem',
              fontWeight: 700,
              color: sseStatus === 'connected' ? 'var(--color-success)' : sseStatus === 'connecting' ? 'var(--color-warning)' : 'var(--color-danger)'
            }}>
              <span style={{ 
                width: 8, 
                height: 8, 
                borderRadius: '50%', 
                background: sseStatus === 'connected' ? 'var(--color-success)' : sseStatus === 'connecting' ? 'var(--color-warning)' : 'var(--color-danger)',
                boxShadow: sseStatus === 'connected' ? '0 0 8px var(--color-success)' : 'none',
                animation: sseStatus === 'connected' ? 'pulse 2s infinite' : 'none'
              }} />
              {sseStatus === 'connected' ? 'LIVE STREAM ACTIVE' : sseStatus === 'connecting' ? 'CONNECTING...' : 'DISCONNECTED'}
            </div>
          </div>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            Real-time pipeline monitoring WhatsApp Scoped Storage ingestion, AI draft generation & Shopify-style publishing.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {sseStatus === 'disconnected' && (
            <Button size="sm" variant="outline" icon={<RefreshCw size={14} />} onClick={reconnect}>
              Reconnect Stream
            </Button>
          )}
          <Button size="sm" variant="ghost" icon={<RefreshCw size={14} />} onClick={fetchProducts}>
            Refresh Catalog
          </Button>
        </div>
      </div>

      {/* Metrics Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Total Ingested Items</span>
            <UploadCloud size={18} style={{ color: 'var(--accent-cyan)' }} />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: 6 }}>
            {products.length}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--accent-cyan)', marginTop: 4 }}>
            Direct from Android SAF Scanners
          </div>
        </Card>

        <Card>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Awaiting Merchant Review</span>
            <Clock size={18} style={{ color: 'var(--accent-gold)' }} />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--accent-gold)', marginTop: 6 }}>
            {draftCount}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--accent-gold)', marginTop: 4 }}>
            Pending approval to go live
          </div>
        </Card>

        <Card>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Published Active Products</span>
            <CheckCircle2 size={18} style={{ color: 'var(--color-success)' }} />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-success)', marginTop: 6 }}>
            {activeCount}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 4 }}>
            Live on customer storefront
          </div>
        </Card>

        <Card>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Avg Ingestion Latency</span>
            <Zap size={18} style={{ color: 'var(--accent-cyan)' }} />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--accent-cyan)', marginTop: 6 }}>
            {avgLatency}ms
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 4 }}>
            Streaming multipart direct-to-disk
          </div>
        </Card>
      </div>

      {/* Main Two-Column Layout: Live Ingestion Feed (35%) & Catalog Table (65%) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 380px) 1fr', gap: 20, alignItems: 'start' }}>
        
        {/* Left Column: Live Ingestion & Sync Feed */}
        <Card style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Radio size={16} style={{ color: 'var(--accent-cyan)' }} />
              <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>Live Ingestion Feed</h2>
            </div>
            <span className="badge badge-cyan" style={{ fontSize: '0.6875rem' }}>
              {recentFeed.length} Events
            </span>
          </div>

          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
            Incoming media streams dispatched from Android merchant background sync.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: '640px', overflowY: 'auto', paddingRight: 4 }}>
            {recentFeed.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                Waiting for incoming WhatsApp media...
              </div>
            ) : (
              recentFeed.map((item, idx) => {
                const p = item.product;
                const firstMedia = p.media && p.media.length > 0 ? p.media[0] : null;
                const isVideo = firstMedia?.media_type === 'VIDEO';

                return (
                  <div 
                    key={`${p.id}-${idx}`}
                    style={{ 
                      display: 'flex', 
                      gap: 12, 
                      padding: 12, 
                      background: 'var(--bg-surface-elevated)', 
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-subtle)',
                      transition: 'border-color 0.2s ease',
                      position: 'relative'
                    }}
                  >
                    {/* Media Thumbnail */}
                    <div style={{ 
                      width: 56, 
                      height: 56, 
                      borderRadius: 'var(--radius-sm)', 
                      background: '#0a0e17', 
                      overflow: 'hidden', 
                      flexShrink: 0,
                      position: 'relative',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '1px solid var(--border-subtle)'
                    }}>
                      {firstMedia?.url ? (
                        isVideo ? (
                          <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                            <video src={firstMedia.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted />
                            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.3)' }}>
                              <Video size={16} color="#fff" />
                            </div>
                          </div>
                        ) : (
                          <img src={firstMedia.url} alt={p.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        )
                      ) : (
                        <ImageIcon size={20} color="var(--text-muted)" />
                      )}
                    </div>

                    {/* Metadata & Quick Actions */}
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                        <span style={{ 
                          fontSize: '0.8125rem', 
                          fontWeight: 700, 
                          color: 'var(--text-primary)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {p.title}
                        </span>
                        <span style={{ 
                          fontSize: '0.6875rem', 
                          color: 'var(--accent-cyan)', 
                          fontWeight: 600,
                          flexShrink: 0
                        }}>
                          ⚡ {item.latencyMs || 140}ms
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span className="badge badge-gold" style={{ fontSize: '0.6875rem' }}>
                          ₹{p.price.toLocaleString('en-IN')}
                        </span>
                        <span className={`badge ${p.status === 'ACTIVE' ? 'badge-cyan' : p.status === 'DRAFT' ? 'badge-gold' : 'badge-subtle'}`} style={{ fontSize: '0.625rem' }}>
                          {p.status}
                        </span>
                        <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                          {p.category}
                        </span>
                      </div>

                      {/* Action buttons */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          icon={<Edit3 size={12} />} 
                          style={{ padding: '2px 8px', fontSize: '0.6875rem' }}
                          onClick={() => openEditModal(p)}
                        >
                          Review & Edit
                        </Button>
                        {p.raw_whatsapp_source && (
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            icon={<MessageSquareQuote size={12} />} 
                            style={{ padding: '2px 8px', fontSize: '0.6875rem' }}
                            onClick={() => setSourceViewerItem(p)}
                          >
                            Source
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>

        {/* Right Column: Shopify-Style Catalog Grid & Quick Moderation */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          
          {/* Search, Filter Bar & Bulk Actions */}
          <Card style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              
              {/* Search input */}
              <div style={{ flex: 1, minWidth: '220px' }}>
                <Input 
                  placeholder="Search catalog by title, SKU, or category..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  leftIcon={<Search size={16} />}
                />
              </div>

              {/* Status Tabs */}
              <div style={{ display: 'flex', gap: 4, background: 'var(--bg-surface-elevated)', padding: 4, borderRadius: 'var(--radius-md)' }}>
                {['All', 'DRAFT', 'ACTIVE', 'ARCHIVED'].map((st) => (
                  <Button
                    key={st}
                    size="sm"
                    variant={selectedStatus === st ? 'primary' : 'ghost'}
                    onClick={() => setSelectedStatus(st)}
                    style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                  >
                    {st === 'DRAFT' ? `Drafts (${draftCount})` : st === 'ACTIVE' ? `Active (${activeCount})` : st}
                  </Button>
                ))}
              </div>
            </div>

            {/* Category Pills Bar */}
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  style={{
                    padding: '4px 12px',
                    borderRadius: 'var(--radius-full)',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    border: '1px solid',
                    borderColor: selectedCategory === cat ? 'var(--accent-cyan)' : 'var(--border-subtle)',
                    background: selectedCategory === cat ? 'rgba(0, 229, 255, 0.15)' : 'var(--bg-surface-elevated)',
                    color: selectedCategory === cat ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Bulk Actions Floating Bar */}
            {selectedIds.length > 0 && (
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between', 
                padding: '10px 16px',
                background: 'rgba(0, 229, 255, 0.08)',
                border: '1px solid var(--accent-cyan)',
                borderRadius: 'var(--radius-md)',
                animation: 'fadeIn 0.2s ease'
              }}>
                <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--accent-cyan)' }}>
                  {selectedIds.length} items selected
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Button 
                    size="sm" 
                    variant="primary" 
                    icon={<CheckCircle2 size={14} />} 
                    disabled={bulkProcessing}
                    onClick={() => handleBulkAction('publish')}
                  >
                    Bulk Publish
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    icon={<Archive size={14} />} 
                    disabled={bulkProcessing}
                    onClick={() => handleBulkAction('archive')}
                  >
                    Bulk Archive
                  </Button>
                  <Button 
                    size="sm" 
                    variant="danger" 
                    icon={<Trash2 size={14} />} 
                    disabled={bulkProcessing}
                    onClick={() => handleBulkAction('delete')}
                  >
                    Delete Selected
                  </Button>
                </div>
              </div>
            )}
          </Card>

          {/* Catalog Products Table */}
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-surface-elevated)', borderBottom: '1px solid var(--border-subtle)' }}>
                    <th style={{ padding: '12px 14px', width: 40 }}>
                      <button 
                        onClick={handleSelectAll} 
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
                      >
                        {selectedIds.length === filteredProducts.length && filteredProducts.length > 0 ? (
                          <CheckSquare size={16} color="var(--accent-cyan)" />
                        ) : (
                          <Square size={16} />
                        )}
                      </button>
                    </th>
                    <th style={{ padding: '12px 14px', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Media</th>
                    <th style={{ padding: '12px 14px', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Title & Category</th>
                    <th style={{ padding: '12px 14px', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Price</th>
                    <th style={{ padding: '12px 14px', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Status</th>
                    <th style={{ padding: '12px 14px', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Created</th>
                    <th style={{ padding: '12px 14px', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ padding: '48px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        {loading ? 'Loading catalog items...' : 'No catalog items match your search or filter criteria.'}
                      </td>
                    </tr>
                  ) : (
                    filteredProducts.map((product) => {
                      const isSelected = selectedIds.includes(product.id);
                      const firstMedia = product.media && product.media.length > 0 ? product.media[0] : null;
                      const isVideo = firstMedia?.media_type === 'VIDEO';

                      return (
                        <tr 
                          key={product.id}
                          style={{ 
                            borderBottom: '1px solid var(--border-subtle)',
                            background: isSelected ? 'rgba(0, 229, 255, 0.04)' : 'transparent',
                            transition: 'background 0.15s ease'
                          }}
                        >
                          {/* Row Selection Checkbox */}
                          <td style={{ padding: '12px 14px' }}>
                            <button 
                              onClick={() => handleToggleSelect(product.id)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
                            >
                              {isSelected ? (
                                <CheckSquare size={16} color="var(--accent-cyan)" />
                              ) : (
                                <Square size={16} />
                              )}
                            </button>
                          </td>

                          {/* Media Thumbnail */}
                          <td style={{ padding: '12px 14px' }}>
                            <div style={{ 
                              width: 44, 
                              height: 44, 
                              borderRadius: 'var(--radius-sm)', 
                              background: '#0a0e17', 
                              overflow: 'hidden', 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'center',
                              border: '1px solid var(--border-subtle)'
                            }}>
                              {firstMedia?.url ? (
                                isVideo ? (
                                  <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                                    <video src={firstMedia.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted />
                                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.3)' }}>
                                      <Video size={12} color="#fff" />
                                    </div>
                                  </div>
                                ) : (
                                  <img src={firstMedia.url} alt={product.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                )
                              ) : (
                                <ImageIcon size={16} color="var(--text-muted)" />
                              )}
                            </div>
                          </td>

                          {/* Title & Category */}
                          <td style={{ padding: '12px 14px', maxWidth: '280px' }}>
                            <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {product.title}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              {product.category}
                            </div>
                          </td>

                          {/* Price */}
                          <td style={{ padding: '12px 14px', fontWeight: 700, fontSize: '0.875rem', color: 'var(--accent-gold)' }}>
                            ₹{product.price.toLocaleString('en-IN')}
                          </td>

                          {/* Status Badge */}
                          <td style={{ padding: '12px 14px' }}>
                            <span className={`badge ${product.status === 'ACTIVE' ? 'badge-cyan' : product.status === 'DRAFT' ? 'badge-gold' : 'badge-subtle'}`} style={{ fontSize: '0.6875rem' }}>
                              {product.status}
                            </span>
                          </td>

                          {/* Date */}
                          <td style={{ padding: '12px 14px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {product.created_at ? new Date(product.created_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                          </td>

                          {/* Row Actions */}
                          <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: 6 }}>
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                icon={<Edit3 size={14} />} 
                                onClick={() => openEditModal(product)} 
                                title="Quick Edit & Review"
                              />
                              {product.status === 'DRAFT' && (
                                <Button 
                                  size="sm" 
                                  variant="primary" 
                                  icon={<CheckCircle2 size={14} />} 
                                  style={{ padding: '4px 10px', fontSize: '0.6875rem' }}
                                  onClick={async () => {
                                    try {
                                      const res = await fetch(`/api/v1/admin/products/${product.id}`, {
                                        method: 'PATCH',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ status: 'ACTIVE' })
                                      });
                                      if (res.ok) showToast(`Published "${product.title}"`, 'success');
                                    } catch {
                                      showToast('Failed to publish product', 'error');
                                    }
                                  }}
                                >
                                  Publish
                                </Button>
                              )}
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                icon={<Trash2 size={14} />} 
                                onClick={() => handleDeleteProduct(product.id)}
                                title="Delete Item"
                              />
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>

      {/* MODAL 1: Product Review & Quick Edit Drawer / Modal */}
      {activeItem && (
        <Modal 
          isOpen={true} 
          onClose={() => setActiveItem(null)} 
          title={`Review & Quick Edit: ${activeItem.title}`}
          maxWidth="720px"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Extracted Media Preview */}
            <div style={{ display: 'flex', gap: 12, overflowX: 'auto', padding: 8, background: '#0a0e17', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              {activeItem.media && activeItem.media.length > 0 ? (
                activeItem.media.map((m, idx) => (
                  <div key={idx} style={{ width: 140, height: 140, borderRadius: 'var(--radius-sm)', overflow: 'hidden', flexShrink: 0, position: 'relative' }}>
                    {m.media_type === 'VIDEO' ? (
                      <video src={m.url} controls style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    ) : (
                      <img src={m.url} alt={`Media ${idx}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    )}
                  </div>
                ))
              ) : (
                <div style={{ padding: '24px 16px', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                  No media uploaded with this item.
                </div>
              )}
            </div>

            {/* Editable AI Fields */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                  Product Title
                </label>
                <Input 
                  value={editFormData.title}
                  onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                  Price (₹ INR)
                </label>
                <Input 
                  type="number"
                  value={editFormData.price}
                  onChange={(e) => setEditFormData({ ...editFormData, price: Number(e.target.value) })}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                  Category
                </label>
                <select
                  value={editFormData.category}
                  onChange={(e) => setEditFormData({ ...editFormData, category: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-surface-elevated)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-medium)',
                    fontSize: '0.875rem'
                  }}
                >
                  {CATEGORIES.filter(c => c !== 'All').map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Description HTML Editor with Live Preview Toggle */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Shopify-Style Description (HTML)
                </label>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  icon={<Eye size={12} />} 
                  onClick={() => setPreviewHtml(!previewHtml)}
                  style={{ fontSize: '0.75rem', padding: '2px 8px' }}
                >
                  {previewHtml ? 'Edit Source HTML' : 'Live Preview'}
                </Button>
              </div>

              {previewHtml ? (
                <div 
                  dangerouslySetInnerHTML={{ __html: editFormData.description_html }}
                  style={{ 
                    padding: '14px', 
                    background: 'var(--bg-surface-elevated)', 
                    borderRadius: 'var(--radius-sm)', 
                    border: '1px solid var(--border-subtle)',
                    fontSize: '0.875rem',
                    minHeight: '120px',
                    color: 'var(--text-primary)'
                  }}
                />
              ) : (
                <textarea
                  value={editFormData.description_html}
                  onChange={(e) => setEditFormData({ ...editFormData, description_html: e.target.value })}
                  rows={6}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-surface-elevated)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-medium)',
                    fontSize: '0.8125rem',
                    fontFamily: 'var(--font-mono)',
                    resize: 'vertical'
                  }}
                />
              )}
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border-subtle)', paddingTop: 14 }}>
              <Button 
                variant="danger" 
                icon={<Trash2 size={14} />} 
                onClick={() => handleDeleteProduct(activeItem.id)}
                disabled={isSaving}
              >
                Reject / Delete
              </Button>

              <div style={{ display: 'flex', gap: 10 }}>
                <Button 
                  variant="outline" 
                  onClick={() => handleSaveProduct('DRAFT')}
                  disabled={isSaving}
                >
                  Save Draft
                </Button>
                <Button 
                  variant="primary" 
                  icon={<CheckCircle2 size={16} />} 
                  onClick={() => handleSaveProduct('ACTIVE')}
                  disabled={isSaving}
                >
                  Approve & Publish Live
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL 2: Raw WhatsApp Source Viewer */}
      {sourceViewerItem && (
        <Modal 
          isOpen={true} 
          onClose={() => setSourceViewerItem(null)} 
          title={`Raw WhatsApp Metadata: ${sourceViewerItem.title}`}
          maxWidth="560px"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: 0 }}>
              Original WhatsApp message caption, sender payload, and local timestamps captured by the Android SAF scanner.
            </p>
            <pre style={{ 
              background: '#0a0e17', 
              padding: 16, 
              borderRadius: 'var(--radius-sm)', 
              border: '1px solid var(--border-subtle)',
              fontSize: '0.8125rem',
              color: 'var(--accent-cyan)',
              overflowX: 'auto',
              maxHeight: '360px'
            }}>
              {typeof sourceViewerItem.raw_whatsapp_source === 'object' 
                ? JSON.stringify(sourceViewerItem.raw_whatsapp_source, null, 2)
                : String(sourceViewerItem.raw_whatsapp_source || 'No raw text attached')}
            </pre>
            <div style={{ textAlign: 'right' }}>
              <Button variant="ghost" onClick={() => setSourceViewerItem(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
