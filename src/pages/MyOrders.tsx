import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, deleteDoc, writeBatch, increment } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { Order, Product, OrderItem } from '../types';
import { Package, Clock, CheckCircle, XCircle, Edit, Trash2, Loader2, X, Plus, Minus } from 'lucide-react';

export const MyOrders: React.FC = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [orderToCancel, setOrderToCancel] = useState<Order | null>(null);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [formData, setFormData] = useState<{
    customerName: string;
    customerPhone: string;
    customerAddress: string;
    items: OrderItem[];
  }>({
    customerName: '',
    customerPhone: '',
    customerAddress: '',
    items: [],
  });
  const [selectedProductId, setSelectedProductId] = useState('');

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'orders'),
      where('userId', '==', user.uid)
    );

    const unsubscribeOrders = onSnapshot(q, (snapshot) => {
      const ordersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
      })) as Order[];
      
      // Sort by createdAt descending in memory to avoid needing a composite index
      ordersData.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      
      setOrders(ordersData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching my orders:", error);
      setLoading(false);
    });

    const unsubscribeProducts = onSnapshot(collection(db, 'products'), (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
    });

    return () => {
      unsubscribeOrders();
      unsubscribeProducts();
    };
  }, [user]);

  const formatRupiah = (price: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const getStatusBadge = (status: Order['status']) => {
    switch (status) {
      case 'pending':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800"><Clock className="h-3 w-3" /> Menunggu</span>;
      case 'processing':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"><Package className="h-3 w-3" /> Diproses</span>;
      case 'completed':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800"><CheckCircle className="h-3 w-3" /> Selesai</span>;
      case 'cancelled':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800"><XCircle className="h-3 w-3" /> Dibatalkan</span>;
      default:
        return null;
    }
  };

  const handleOpenEditModal = (order: Order) => {
    setEditingOrder(order);
    setFormData({
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      customerAddress: order.customerAddress,
      items: [...order.items],
    });
    setSelectedProductId('');
    setIsEditModalOpen(true);
  };

  const handleUpdateQuantity = (productId: string, delta: number) => {
    setFormData(prev => {
      const newItems = [...prev.items];
      const itemIndex = newItems.findIndex(i => i.productId === productId);
      if (itemIndex >= 0) {
        const item = newItems[itemIndex];
        const product = products.find(p => p.id === productId);
        
        const originalItem = editingOrder?.items.find(i => i.productId === productId);
        const originalQty = originalItem ? originalItem.quantity : 0;
        const availableStock = (product?.stock || 0) + originalQty;

        const newQty = item.quantity + delta;
        if (newQty > 0 && newQty <= availableStock) {
          newItems[itemIndex] = { ...item, quantity: newQty };
        }
      }
      return { ...prev, items: newItems };
    });
  };

  const handleRemoveItem = (productId: string) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter(i => i.productId !== productId)
    }));
  };

  const handleAddProduct = () => {
    if (!selectedProductId) return;
    const product = products.find(p => p.id === selectedProductId);
    if (!product || product.stock <= 0) return;

    setFormData(prev => {
      const existingItem = prev.items.find(i => i.productId === selectedProductId);
      if (existingItem) {
        return prev;
      }
      return {
        ...prev,
        items: [...prev.items, {
          productId: product.id,
          productCode: product.productCode,
          name: product.name,
          price: product.price,
          quantity: 1,
          unit: product.unit
        }]
      };
    });
    setSelectedProductId('');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOrder) return;

    if (formData.items.length === 0) {
      alert("Pesanan harus memiliki minimal 1 produk. Jika ingin membatalkan, gunakan tombol Batalkan Pesanan.");
      return;
    }

    try {
      const batch = writeBatch(db);
      const orderRef = doc(db, 'orders', editingOrder.id);
      
      const stockChanges: Record<string, number> = {};
      
      editingOrder.items.forEach(item => {
        stockChanges[item.productId] = (stockChanges[item.productId] || 0) + item.quantity;
      });
      
      formData.items.forEach(item => {
        stockChanges[item.productId] = (stockChanges[item.productId] || 0) - item.quantity;
      });

      for (const [productId, change] of Object.entries(stockChanges)) {
        if (change !== 0) {
          const productRef = doc(db, 'products', productId);
          batch.update(productRef, {
            stock: increment(change)
          });
        }
      }

      const newTotalAmount = formData.items.reduce((total, item) => total + (item.price * item.quantity), 0);

      batch.update(orderRef, {
        customerName: formData.customerName,
        customerPhone: formData.customerPhone,
        customerAddress: formData.customerAddress,
        items: formData.items,
        totalAmount: newTotalAmount
      });

      await batch.commit();
      setIsEditModalOpen(false);
    } catch (error) {
      console.error("Error updating order:", error);
      alert("Gagal memperbarui pesanan.");
    }
  };

  const handleCancelClick = (order: Order) => {
    setOrderToCancel(order);
    setIsCancelModalOpen(true);
  };

  const handleConfirmCancel = async () => {
    if (!orderToCancel) return;

    try {
      const batch = writeBatch(db);
      const orderRef = doc(db, 'orders', orderToCancel.id);
      
      // Update status to cancelled
      batch.update(orderRef, { status: 'cancelled' });

      // Restore stock
      orderToCancel.items.forEach(item => {
        const productRef = doc(db, 'products', item.productId);
        batch.update(productRef, {
          stock: increment(item.quantity)
        });
      });

      await batch.commit();
      setIsCancelModalOpen(false);
      setOrderToCancel(null);
    } catch (error) {
      console.error("Error cancelling order:", error);
      alert("Gagal membatalkan pesanan.");
    }
  };

  if (loading) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center text-gray-500">
        <Loader2 className="h-12 w-12 animate-spin text-indigo-600 mb-4" />
        <p className="text-lg font-medium">Memuat pesanan Anda...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-3xl font-extrabold text-gray-900 mb-8">Pesanan Saya</h1>

      {orders.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-3xl border border-gray-100 shadow-sm">
          <Package className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-gray-900 mb-2">Belum Ada Pesanan</h3>
          <p className="text-gray-500">Anda belum membuat pesanan apapun.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {orders.map((order) => (
            <div key={order.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <span className="font-bold text-gray-900">{order.orderCode}</span>
                    {getStatusBadge(order.status)}
                  </div>
                  <p className="text-sm text-gray-500">
                    {order.createdAt.toLocaleDateString('id-ID', {
                      day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
                    })}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500 mb-1">Total Belanja</p>
                  <p className="text-xl font-bold text-indigo-600">{formatRupiah(order.totalAmount)}</p>
                </div>
              </div>
              
              <div className="p-6 bg-gray-50">
                <h4 className="font-semibold text-gray-900 mb-4">Detail Pengiriman</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500">Nama Penerima</p>
                    <p className="font-medium text-gray-900">{order.customerName}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Nomor WhatsApp</p>
                    <p className="font-medium text-gray-900">{order.customerPhone}</p>
                  </div>
                  <div className="md:col-span-2">
                    <p className="text-gray-500">Alamat Pengiriman</p>
                    <p className="font-medium text-gray-900">{order.customerAddress}</p>
                  </div>
                </div>
              </div>

              <div className="p-6">
                <h4 className="font-semibold text-gray-900 mb-4">Produk yang Dipesan</h4>
                <div className="space-y-4">
                  {order.items.map((item, index) => (
                    <div key={index} className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0">
                      <div>
                        <p className="font-medium text-gray-900">{item.name}</p>
                        <p className="text-sm text-gray-500">{item.quantity} {item.unit || ''} x {formatRupiah(item.price)}</p>
                      </div>
                      <p className="font-bold text-gray-900">{formatRupiah(item.price * item.quantity)}</p>
                    </div>
                  ))}
                </div>
              </div>

              {order.status === 'pending' && (
                <div className="p-6 border-t border-gray-100 flex justify-end gap-3 bg-white">
                  <button
                    onClick={() => handleOpenEditModal(order)}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
                  >
                    <Edit className="h-4 w-4" />
                    Edit Pesanan
                  </button>
                  <button
                    onClick={() => handleCancelClick(order)}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                    Batalkan Pesanan
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Edit Modal */}
      {isEditModalOpen && editingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex justify-between items-center p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900">Edit Pesanan</h2>
              <button onClick={() => setIsEditModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X className="h-6 w-6" />
              </button>
            </div>
            <form onSubmit={handleSaveEdit} className="p-6 overflow-y-auto space-y-6 flex-1">
              <div className="space-y-4">
                <h3 className="font-semibold text-gray-900 border-b pb-2">Info Pengiriman</h3>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nama Penerima</label>
                  <input
                    type="text"
                    required
                    value={formData.customerName}
                    onChange={(e) => setFormData({...formData, customerName: e.target.value})}
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nomor WhatsApp</label>
                  <input
                    type="tel"
                    required
                    value={formData.customerPhone}
                    onChange={(e) => setFormData({...formData, customerPhone: e.target.value})}
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Alamat Pengiriman</label>
                  <textarea
                    required
                    rows={3}
                    value={formData.customerAddress}
                    onChange={(e) => setFormData({...formData, customerAddress: e.target.value})}
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all outline-none resize-none"
                  ></textarea>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold text-gray-900 border-b pb-2">Produk Pesanan</h3>
                
                <div className="flex gap-2">
                  <select
                    value={selectedProductId}
                    onChange={(e) => setSelectedProductId(e.target.value)}
                    className="flex-1 px-4 py-2 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all outline-none"
                  >
                    <option value="">Pilih Produk untuk Ditambahkan...</option>
                    {products.filter(p => p.stock > 0).map(product => (
                      <option key={product.id} value={product.id}>
                        {product.name} - {formatRupiah(product.price)} (Sisa: {product.stock})
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleAddProduct}
                    disabled={!selectedProductId}
                    className="px-4 py-2 bg-indigo-100 text-indigo-700 rounded-xl hover:bg-indigo-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Plus className="h-5 w-5" />
                  </button>
                </div>

                <div className="space-y-3 mt-4">
                  {formData.items.map(item => (
                    <div key={item.productId} className="flex items-center justify-between bg-gray-50 p-3 rounded-xl border border-gray-100">
                      <div className="flex-1 pr-4">
                        <p className="font-medium text-gray-900 line-clamp-1">{item.name}</p>
                        <p className="text-sm text-gray-500">{formatRupiah(item.price)}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center bg-white rounded-lg border border-gray-200">
                          <button
                            type="button"
                            onClick={() => handleUpdateQuantity(item.productId, -1)}
                            className="p-1.5 text-gray-500 hover:text-indigo-600 transition-colors"
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                          <span className="w-8 text-center font-medium text-gray-900">{item.quantity}</span>
                          <button
                            type="button"
                            onClick={() => handleUpdateQuantity(item.productId, 1)}
                            className="p-1.5 text-gray-500 hover:text-indigo-600 transition-colors"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.productId)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {formData.items.length === 0 && (
                    <p className="text-sm text-red-500 text-center py-2">Pesanan harus memiliki minimal 1 produk.</p>
                  )}
                </div>
                <div className="flex justify-between items-center pt-4 border-t border-gray-100">
                  <span className="font-medium text-gray-700">Total Baru:</span>
                  <span className="text-lg font-bold text-indigo-600">
                    {formatRupiah(formData.items.reduce((total, item) => total + (item.price * item.quantity), 0))}
                  </span>
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3 sticky bottom-0 bg-white border-t border-gray-100 mt-6 -mx-6 px-6 pb-2">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={formData.items.length === 0}
                  className="px-5 py-2.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Cancel Confirmation Modal */}
      {isCancelModalOpen && orderToCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden p-6 text-center">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 className="h-8 w-8" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Batalkan Pesanan?</h2>
            <p className="text-gray-500 mb-6">Apakah Anda yakin ingin membatalkan pesanan ini? Tindakan ini tidak dapat diurungkan.</p>
            <div className="flex justify-center gap-3">
              <button
                onClick={() => {
                  setIsCancelModalOpen(false);
                  setOrderToCancel(null);
                }}
                className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors flex-1"
              >
                Tidak, Kembali
              </button>
              <button
                onClick={handleConfirmCancel}
                className="px-5 py-2.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors shadow-sm flex-1"
              >
                Ya, Batalkan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
