import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, addDoc, updateDoc, doc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Product, Order } from '../types';
import { useAuth } from '../context/AuthContext';
import { Package, ShoppingBag, Plus, Trash2, Edit, X, Check, Loader2, ShieldAlert } from 'lucide-react';

export const Admin: React.FC = () => {
  const { isAdmin, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<'products' | 'orders'>('products');
  
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState({
    productCode: '',
    name: '',
    description: '',
    price: '',
    category: '',
    imageUrl: '',
    stock: '',
  });

  useEffect(() => {
    if (!isAdmin) return;

    const qProducts = query(collection(db, 'products'), orderBy('createdAt', 'desc'));
    const unsubProducts = onSnapshot(qProducts, (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
      setLoading(false);
    });

    const qOrders = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
    const unsubOrders = onSnapshot(qOrders, (snapshot) => {
      setOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order)));
    });

    return () => {
      unsubProducts();
      unsubOrders();
    };
  }, [isAdmin]);

  if (authLoading || loading) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center text-gray-500">
        <Loader2 className="h-12 w-12 animate-spin text-indigo-600 mb-4" />
        <p className="text-lg font-medium">Memuat data admin...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center text-gray-500">
        <ShieldAlert className="h-16 w-16 text-red-500 mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Akses Ditolak</h1>
        <p className="text-lg">Anda tidak memiliki izin untuk mengakses halaman ini.</p>
      </div>
    );
  }

  const handleOpenModal = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setFormData({
        productCode: product.productCode || '',
        name: product.name,
        description: product.description,
        price: product.price.toString(),
        category: product.category,
        imageUrl: product.imageUrl,
        stock: product.stock.toString(),
      });
    } else {
      setEditingProduct(null);
      setFormData({ productCode: '', name: '', description: '', price: '', category: '', imageUrl: '', stock: '' });
    }
    setIsModalOpen(true);
  };

  const handleSubmitProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let newProductCode = formData.productCode;
      if (!newProductCode || newProductCode.trim() === '') {
        const maxCode = products.reduce((max, p) => {
          const num = p.productCode ? parseInt(p.productCode.replace(/\D/g, ''), 10) : 0;
          return num > max ? num : max;
        }, 0);
        newProductCode = `PRD-${String(maxCode + 1).padStart(3, '0')}`;
      }

      const productData = {
        name: formData.name,
        description: formData.description,
        price: Number(formData.price),
        category: formData.category,
        imageUrl: formData.imageUrl,
        stock: Number(formData.stock),
        productCode: newProductCode,
      };

      if (editingProduct) {
        await updateDoc(doc(db, 'products', editingProduct.id), productData);
      } else {
        await addDoc(collection(db, 'products'), {
          ...productData,
          createdAt: serverTimestamp(),
        });
      }
      setIsModalOpen(false);
    } catch (error) {
      console.error("Error saving product:", error);
      // alert("Gagal menyimpan produk.");
    }
  };

  const handleDeleteProduct = async (id: string) => {
    // Custom confirm logic can be implemented here, but for now we'll just delete it directly
    // to avoid window.confirm in iframe.
    try {
      await deleteDoc(doc(db, 'products', id));
    } catch (error) {
      console.error("Error deleting product:", error);
      // alert("Gagal menghapus produk.");
    }
  };

  const handleUpdateOrderStatus = async (orderId: string, status: Order['status']) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), { status });
    } catch (error) {
      console.error("Error updating order status:", error);
      // alert("Gagal memperbarui status pesanan.");
    }
  };

  const formatRupiah = (price: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(price);
  };

  const statusColors = {
    pending: 'bg-yellow-100 text-yellow-800',
    processing: 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
  };

  const statusLabels = {
    pending: 'Menunggu',
    processing: 'Diproses',
    completed: 'Selesai',
    cancelled: 'Dibatalkan',
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight mb-2">Dashboard Admin</h1>
          <p className="text-gray-500">Kelola produk dan pantau pesanan pelanggan.</p>
        </div>
        
        <div className="flex bg-gray-100 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('products')}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all ${
              activeTab === 'products' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Package className="h-5 w-5" />
            Produk
          </button>
          <button
            onClick={() => setActiveTab('orders')}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all ${
              activeTab === 'orders' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <ShoppingBag className="h-5 w-5" />
            Pesanan
          </button>
        </div>
      </div>

      {activeTab === 'products' && (
        <div className="space-y-6">
          <div className="flex justify-end">
            <button
              onClick={() => handleOpenModal()}
              className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-sm"
            >
              <Plus className="h-5 w-5" />
              Tambah Produk
            </button>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100 text-gray-500 text-sm font-semibold uppercase tracking-wider">
                    <th className="p-4 pl-6">Kode Produk</th>
                    <th className="p-4">Produk</th>
                    <th className="p-4">Kategori</th>
                    <th className="p-4">Harga</th>
                    <th className="p-4">Stok</th>
                    <th className="p-4 pr-6 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {products.map((product) => (
                    <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                      <td className="p-4 pl-6 font-mono text-sm text-gray-500">
                        {product.productCode || '-'}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-4">
                          <img src={product.imageUrl} alt={product.name} className="h-12 w-12 rounded-lg object-cover bg-gray-100" referrerPolicy="no-referrer" />
                          <div>
                            <p className="font-bold text-gray-900 line-clamp-1">{product.name}</p>
                            <p className="text-sm text-gray-500 line-clamp-1">{product.description}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          {product.category}
                        </span>
                      </td>
                      <td className="p-4 font-medium text-gray-900">{formatRupiah(product.price)}</td>
                      <td className="p-4">
                        <span className={`font-medium ${product.stock > 10 ? 'text-green-600' : product.stock > 0 ? 'text-yellow-600' : 'text-red-600'}`}>
                          {product.stock}
                        </span>
                      </td>
                      <td className="p-4 pr-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => handleOpenModal(product)} className="p-2 text-gray-400 hover:text-blue-600 transition-colors rounded-lg hover:bg-blue-50">
                            <Edit className="h-5 w-5" />
                          </button>
                          <button onClick={() => handleDeleteProduct(product.id)} className="p-2 text-gray-400 hover:text-red-600 transition-colors rounded-lg hover:bg-red-50">
                            <Trash2 className="h-5 w-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {products.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-gray-500">Belum ada produk. Tambahkan produk pertama Anda.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'orders' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100 text-gray-500 text-sm font-semibold uppercase tracking-wider">
                    <th className="p-4 pl-6">Kode Pesanan</th>
                    <th className="p-4">Tanggal</th>
                    <th className="p-4">Pelanggan</th>
                    <th className="p-4">No. Telepon</th>
                    <th className="p-4">Alamat Pengiriman</th>
                    <th className="p-4">Detail Produk</th>
                    <th className="p-4">Total</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 pr-6 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {orders.map((order) => (
                    <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                      <td className="p-4 pl-6">
                        <p className="font-mono font-bold text-indigo-600">{order.orderCode || order.id.slice(0, 8).toUpperCase()}</p>
                      </td>
                      <td className="p-4">
                        <p className="text-sm text-gray-600">
                          {order.createdAt ? new Date((order.createdAt as any).seconds * 1000).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                        </p>
                      </td>
                      <td className="p-4">
                        <p className="font-bold text-gray-900">{order.customerName}</p>
                      </td>
                      <td className="p-4">
                        <p className="text-sm text-gray-500">{order.customerPhone}</p>
                      </td>
                      <td className="p-4 max-w-xs">
                        <p className="text-sm text-gray-500 line-clamp-2" title={order.customerAddress}>{order.customerAddress}</p>
                      </td>
                      <td className="p-4 min-w-[200px]">
                        <div className="flex flex-col gap-1.5 max-h-28 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-200">
                          {order.items?.map((item, idx) => (
                            <div key={idx} className="text-sm flex justify-between items-start gap-3 border-b border-gray-50 pb-1.5 last:border-0 last:pb-0">
                              <div>
                                {item.productCode && <span className="text-xs font-mono text-indigo-500 block mb-0.5">{item.productCode}</span>}
                                <span className="font-medium text-gray-800 line-clamp-2" title={item.name}>{item.name}</span>
                              </div>
                              <span className="text-gray-500 font-mono whitespace-nowrap bg-gray-50 px-1.5 py-0.5 rounded text-xs mt-1">x{item.quantity}</span>
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="p-4 font-bold text-indigo-600">{formatRupiah(order.totalAmount)}</td>
                      <td className="p-4">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${statusColors[order.status]}`}>
                          {statusLabels[order.status]}
                        </span>
                      </td>
                      <td className="p-4 pr-6 text-right">
                        <select
                          value={order.status}
                          onChange={(e) => handleUpdateOrderStatus(order.id, e.target.value as Order['status'])}
                          className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500 outline-none"
                        >
                          <option value="pending">Menunggu</option>
                          <option value="processing">Diproses</option>
                          <option value="completed">Selesai</option>
                          <option value="cancelled">Batal</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                  {orders.length === 0 && (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-gray-500">Belum ada pesanan masuk.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal Tambah/Edit Produk */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between z-10">
              <h2 className="text-xl font-bold text-gray-900">{editingProduct ? 'Edit Produk' : 'Tambah Produk Baru'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 text-gray-400 hover:bg-gray-100 rounded-full transition-colors">
                <X className="h-6 w-6" />
              </button>
            </div>
            <form onSubmit={handleSubmitProduct} className="p-6 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Kode Produk</label>
                  <input type="text" value={formData.productCode} onChange={(e) => setFormData({...formData, productCode: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all outline-none bg-gray-50" placeholder="Contoh: PRD-001" />
                  <p className="text-xs text-gray-500 mt-1">Kosongkan jika ingin sistem membuat kode otomatis.</p>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nama Produk</label>
                  <input type="text" required value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all outline-none" placeholder="Contoh: Kertas HVS A4" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Deskripsi</label>
                  <textarea required rows={3} value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all outline-none resize-none" placeholder="Deskripsi lengkap produk..."></textarea>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Harga (Rp)</label>
                  <input type="number" min="0" required value={formData.price} onChange={(e) => setFormData({...formData, price: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all outline-none" placeholder="50000" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Stok</label>
                  <input type="number" min="0" required value={formData.stock} onChange={(e) => setFormData({...formData, stock: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all outline-none" placeholder="100" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Kategori</label>
                  <input type="text" required value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all outline-none" placeholder="Contoh: ATK" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">URL Gambar</label>
                  <input type="url" required value={formData.imageUrl} onChange={(e) => setFormData({...formData, imageUrl: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all outline-none" placeholder="https://example.com/image.jpg" />
                </div>
              </div>
              <div className="pt-6 flex justify-end gap-3 border-t border-gray-100">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-3 rounded-xl font-medium text-gray-600 hover:bg-gray-100 transition-colors">Batal</button>
                <button type="submit" className="px-6 py-3 rounded-xl font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-sm flex items-center gap-2">
                  <Check className="h-5 w-5" />
                  Simpan Produk
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
