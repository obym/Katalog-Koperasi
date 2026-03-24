import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, addDoc, updateDoc, doc, deleteDoc, serverTimestamp, writeBatch, increment } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Product, Order, CustomOrder, OrderItem } from '../types';
import { useAuth } from '../context/AuthContext';
import { Package, ShoppingBag, Plus, Trash2, Edit, X, Check, Loader2, ShieldAlert, Download, History, Users, MessageSquare } from 'lucide-react';

export const Admin: React.FC = () => {
  const { isAdmin, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<'products' | 'orders' | 'users'>('products');
  const [activeOrdersTab, setActiveOrdersTab] = useState<'active' | 'history' | 'custom'>('active');
  
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [customOrders, setCustomOrders] = useState<CustomOrder[]>([]);
  const [users, setUsers] = useState<any[]>([]);
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
    unit: '',
  });

  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);

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

    const qCustomOrders = query(collection(db, 'customOrders'), orderBy('createdAt', 'desc'));
    const unsubCustomOrders = onSnapshot(qCustomOrders, (snapshot) => {
      setCustomOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CustomOrder)));
    });

    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const usersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      usersData.sort((a: any, b: any) => {
        const dateA = a.createdAt?.seconds || 0;
        const dateB = b.createdAt?.seconds || 0;
        return dateB - dateA;
      });
      setUsers(usersData);
    }, (error) => {
      console.error("Error fetching users:", error);
    });

    return () => {
      unsubProducts();
      unsubOrders();
      unsubCustomOrders();
      unsubUsers();
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
        unit: product.unit || '',
      });
    } else {
      setEditingProduct(null);
      setFormData({ productCode: '', name: '', description: '', price: '', category: '', imageUrl: '', stock: '', unit: '' });
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
        unit: formData.unit,
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

  const handleUpdateCustomOrderStatus = async (orderId: string, status: CustomOrder['status']) => {
    try {
      const order = customOrders.find(o => o.id === orderId);
      if (!order) return;

      const updateData = {
        status,
        customerName: order.customerName || 'Unknown',
        customerPhone: order.customerPhone || 'Unknown',
        customerAddress: order.customerAddress || 'Unknown',
        description: order.description || '',
        productName: order.productName || 'Unknown Product'
      };

      if (status === 'completed' && order.status !== 'completed') {
        const batch = writeBatch(db);
        const customOrderRef = doc(db, 'customOrders', orderId);
        batch.update(customOrderRef, updateData);

        // Generate a new product code
        const maxCode = products.reduce((max, p) => {
          const num = p.productCode ? parseInt(p.productCode.replace(/\D/g, ''), 10) : 0;
          return num > max ? num : max;
        }, 0);
        const newProductCode = `PRD-${String(maxCode + 1).padStart(3, '0')}`;

        const newProductRef = doc(collection(db, 'products'));
        batch.set(newProductRef, {
          name: order.productName || 'Unknown Product',
          description: order.description || '',
          price: order.price || 0,
          category: 'Pesanan Khusus',
          imageUrl: order.imageUrl || '',
          stock: order.quantity || 0,
          unit: order.unit || 'pcs',
          productCode: newProductCode,
          createdAt: serverTimestamp()
        });
        
        // Generate a new order code
        const timestampStr = Date.now().toString().slice(-6);
        const randomStr = Math.random().toString(36).substring(2, 5).toUpperCase();
        const orderCode = `ORD-${timestampStr}${randomStr}`;

        // Create an active order for the user
        const newOrderRef = doc(collection(db, 'orders'));
        batch.set(newOrderRef, {
          orderCode,
          userId: order.userId,
          customerName: order.customerName || 'Unknown',
          customerPhone: order.customerPhone || 'Unknown',
          customerAddress: order.customerAddress || 'Unknown',
          items: [{
            productId: newProductRef.id,
            productCode: newProductCode,
            name: order.productName || 'Unknown Product',
            quantity: order.quantity || 1,
            price: order.price || 0,
            unit: order.unit || 'pcs'
          }],
          totalAmount: (order.price || 0) * (order.quantity || 1),
          status: 'pending',
          createdAt: serverTimestamp()
        });
        
        await batch.commit();
        alert(`Pesanan khusus selesai. Produk "${order.productName || 'Unknown Product'}" telah ditambahkan ke katalog dan pesanan aktif telah dibuat.`);
      } else {
        await updateDoc(doc(db, 'customOrders', orderId), updateData);
      }
    } catch (error) {
      console.error("Error updating custom order status:", error);
      alert("Gagal memperbarui status pesanan khusus.");
    }
  };

  const handleDeleteCustomOrder = async (orderId: string) => {
    try {
      await deleteDoc(doc(db, 'customOrders', orderId));
    } catch (error) {
      console.error("Error deleting custom order:", error);
    }
  };

  const handleUpdateOrderStatus = async (order: Order, status: Order['status']) => {
    try {
      const batch = writeBatch(db);
      const orderRef = doc(db, 'orders', order.id);
      batch.update(orderRef, { status });

      if (order.status !== 'cancelled' && status === 'cancelled') {
        // Restore stock
        order.items.forEach(item => {
          const productRef = doc(db, 'products', item.productId);
          batch.update(productRef, { stock: increment(item.quantity) });
        });
      } else if (order.status === 'cancelled' && status !== 'cancelled') {
        // Reduce stock again
        order.items.forEach(item => {
          const productRef = doc(db, 'products', item.productId);
          batch.update(productRef, { stock: increment(-item.quantity) });
        });
      }

      await batch.commit();
    } catch (error) {
      console.error("Error updating order status:", error);
      // alert("Gagal memperbarui status pesanan.");
    }
  };

  const handleOpenOrderModal = (order: Order) => {
    setEditingOrder(order);
    setOrderItems([...order.items]);
    setIsOrderModalOpen(true);
  };

  const handleUpdateOrderItemQuantity = (index: number, newQuantity: number | string) => {
    const newItems = [...orderItems];
    if (newQuantity === '') {
      (newItems[index] as any).quantity = '';
    } else {
      const parsed = typeof newQuantity === 'string' ? parseInt(newQuantity) : newQuantity;
      if (!isNaN(parsed) && parsed >= 0) {
        newItems[index].quantity = parsed;
      }
    }
    setOrderItems(newItems);
  };

  const handleRemoveOrderItem = (index: number) => {
    const newItems = [...orderItems];
    newItems.splice(index, 1);
    setOrderItems(newItems);
  };

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOrder) return;
    
    if (orderItems.length === 0) {
      alert("Pesanan harus memiliki setidaknya satu produk.");
      return;
    }

    // Ensure all quantities are valid numbers before saving
    const validItems = orderItems.map(item => ({
      ...item,
      quantity: Number(item.quantity) || 1
    }));

    const totalAmount = validItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    try {
      const batch = writeBatch(db);
      const orderRef = doc(db, 'orders', editingOrder.id);
      batch.update(orderRef, {
        items: validItems,
        totalAmount: totalAmount
      });

      if (editingOrder.status !== 'cancelled') {
        const oldQuantities: Record<string, number> = {};
        editingOrder.items.forEach(item => {
          oldQuantities[item.productId] = (oldQuantities[item.productId] || 0) + item.quantity;
        });

        const newQuantities: Record<string, number> = {};
        validItems.forEach(item => {
          newQuantities[item.productId] = (newQuantities[item.productId] || 0) + item.quantity;
        });

        const allProductIds = new Set([...Object.keys(oldQuantities), ...Object.keys(newQuantities)]);

        allProductIds.forEach(productId => {
          const oldQ = oldQuantities[productId] || 0;
          const newQ = newQuantities[productId] || 0;
          const diff = oldQ - newQ;
          
          if (diff !== 0) {
            const productRef = doc(db, 'products', productId);
            batch.update(productRef, {
              stock: increment(diff)
            });
          }
        });
      }

      await batch.commit();
      setIsOrderModalOpen(false);
    } catch (error) {
      console.error("Error updating order:", error);
    }
  };

  const handleDeleteOrder = async (order: Order) => {
    try {
      const batch = writeBatch(db);
      const orderRef = doc(db, 'orders', order.id);
      batch.delete(orderRef);

      // Restore stock if the order wasn't already cancelled
      if (order.status !== 'cancelled') {
        order.items.forEach(item => {
          const productRef = doc(db, 'products', item.productId);
          batch.update(productRef, { stock: increment(item.quantity) });
        });
      }

      await batch.commit();
    } catch (error) {
      console.error("Error deleting order:", error);
    }
  };

  const handleToggleAdmin = async (userId: string, currentRole: string) => {
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        role: currentRole === 'admin' ? 'customer' : 'admin'
      });
    } catch (error) {
      console.error("Error updating user role:", error);
      alert("Gagal mengubah peran pengguna.");
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      await deleteDoc(doc(db, 'users', userId));
      setUserToDelete(null);
    } catch (error) {
      console.error("Error deleting user:", error);
      alert("Gagal menghapus pengguna.");
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

  const handleDownloadCSV = () => {
    const ordersToExport = activeOrdersTab === 'active' 
      ? orders.filter(o => o.status === 'pending' || o.status === 'processing')
      : orders.filter(o => o.status === 'completed' || o.status === 'cancelled');

    const headers = ['Kode Pesanan', 'Tanggal', 'Pelanggan', 'No. Telepon', 'Alamat Pengiriman', 'Total', 'Status', 'Detail Produk'];
    const rows = ordersToExport.map(order => {
      const date = order.createdAt ? new Date((order.createdAt as any).seconds * 1000).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';
      const items = order.items.map(item => `${item.name} (x${item.quantity} ${item.unit || ''})`).join('; ');
      return [
        order.orderCode || order.id.slice(0, 8).toUpperCase(),
        date,
        `"${order.customerName.replace(/"/g, '""')}"`,
        `"${order.customerPhone.replace(/"/g, '""')}"`,
        `"${order.customerAddress.replace(/"/g, '""')}"`,
        order.totalAmount,
        statusLabels[order.status],
        `"${items.replace(/"/g, '""')}"`
      ].join(',');
    });
    
    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `pesanan_${activeOrdersTab}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const activeOrders = orders.filter(o => o.status === 'pending' || o.status === 'processing');
  const historyOrders = orders.filter(o => o.status === 'completed' || o.status === 'cancelled');
  const displayOrders = activeOrdersTab === 'active' ? activeOrders : historyOrders;

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
          <button
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all ${
              activeTab === 'users' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Users className="h-5 w-5" />
            Pengguna
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
                          {product.stock} {product.unit || ''}
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
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex bg-gray-100 p-1 rounded-xl inline-flex w-full sm:w-auto">
              <button
                onClick={() => setActiveOrdersTab('active')}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  activeOrdersTab === 'active' 
                    ? 'bg-white text-indigo-600 shadow-sm' 
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'
                }`}
              >
                <ShoppingBag className="h-4 w-4" />
                Pesanan Aktif
                {activeOrders.length > 0 && (
                  <span className="ml-1.5 bg-indigo-100 text-indigo-600 py-0.5 px-2 rounded-full text-xs">
                    {activeOrders.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveOrdersTab('history')}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  activeOrdersTab === 'history' 
                    ? 'bg-white text-indigo-600 shadow-sm' 
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'
                }`}
              >
                <History className="h-4 w-4" />
                Riwayat
                {historyOrders.length > 0 && (
                  <span className="ml-1.5 bg-gray-200 text-gray-700 py-0.5 px-2 rounded-full text-xs">
                    {historyOrders.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveOrdersTab('custom')}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  activeOrdersTab === 'custom' 
                    ? 'bg-white text-indigo-600 shadow-sm' 
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'
                }`}
              >
                <MessageSquare className="h-4 w-4" />
                Pesanan Khusus
                {customOrders.length > 0 && (
                  <span className="ml-1.5 bg-indigo-100 text-indigo-600 py-0.5 px-2 rounded-full text-xs">
                    {customOrders.length}
                  </span>
                )}
              </button>
            </div>
            
            <button
              onClick={handleDownloadCSV}
              className="flex items-center gap-2 bg-green-600 text-white px-5 py-2.5 rounded-xl font-medium hover:bg-green-700 transition-colors shadow-sm w-full sm:w-auto justify-center"
            >
              <Download className="h-4 w-4" />
              Download CSV (Google Sheets)
            </button>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              {activeOrdersTab === 'custom' ? (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100 text-gray-500 text-sm font-semibold uppercase tracking-wider">
                      <th className="p-4 pl-6">Tanggal</th>
                      <th className="p-4">Pelanggan</th>
                      <th className="p-4">No. Telepon</th>
                      <th className="p-4">Alamat</th>
                      <th className="p-4">Produk Diminta</th>
                      <th className="p-4">Detail & Harga</th>
                      <th className="p-4">Status</th>
                      <th className="p-4 pr-6 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {customOrders.map((order) => (
                      <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                        <td className="p-4 pl-6">
                          <p className="text-sm text-gray-600">
                            {order.createdAt?.seconds ? new Date((order.createdAt as any).seconds * 1000).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Baru saja'}
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
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            {order.imageUrl ? (
                              <img src={order.imageUrl} alt={order.productName} className="w-10 h-10 rounded-lg object-cover border border-gray-200" referrerPolicy="no-referrer" />
                            ) : (
                              <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center border border-gray-200">
                                <Package className="h-5 w-5 text-gray-400" />
                              </div>
                            )}
                            <p className="font-medium text-gray-900">{order.productName}</p>
                          </div>
                        </td>
                        <td className="p-4 max-w-xs">
                          <div className="text-sm text-gray-500 mb-1">
                            <span className="font-medium text-gray-700">{order.quantity} {order.unit}</span>
                            {order.price > 0 && <span> • {formatRupiah(order.price)}</span>}
                          </div>
                          <p className="text-sm text-gray-500 line-clamp-2" title={order.description}>{order.description}</p>
                        </td>
                        <td className="p-4">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${statusColors[order.status]}`}>
                            {statusLabels[order.status]}
                          </span>
                        </td>
                        <td className="p-4 pr-6 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <select
                              value={order.status}
                              onChange={(e) => handleUpdateCustomOrderStatus(order.id, e.target.value as CustomOrder['status'])}
                              className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500 outline-none"
                            >
                              <option value="pending">Menunggu</option>
                              <option value="processing">Diproses</option>
                              <option value="completed">Selesai</option>
                              <option value="cancelled">Batal</option>
                            </select>
                            <button
                              onClick={() => handleDeleteCustomOrder(order.id)}
                              className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                              title="Hapus Permintaan"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {customOrders.length === 0 && (
                      <tr>
                        <td colSpan={8} className="p-8 text-center text-gray-500">
                          Belum ada permintaan produk khusus.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              ) : (
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
                    {displayOrders.map((order) => (
                      <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                        <td className="p-4 pl-6">
                          <p className="font-mono font-bold text-indigo-600">{order.orderCode || order.id.slice(0, 8).toUpperCase()}</p>
                        </td>
                        <td className="p-4">
                          <p className="text-sm text-gray-600">
                            {order.createdAt?.seconds ? new Date((order.createdAt as any).seconds * 1000).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Baru saja'}
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
                              <span className="text-gray-500 font-mono whitespace-nowrap bg-gray-50 px-1.5 py-0.5 rounded text-xs mt-1">x{item.quantity} {item.unit || ''}</span>
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
                        <div className="flex items-center justify-end gap-2">
                          <select
                            value={order.status}
                            onChange={(e) => handleUpdateOrderStatus(order, e.target.value as Order['status'])}
                            className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500 outline-none"
                          >
                            <option value="pending">Menunggu</option>
                            <option value="processing">Diproses</option>
                            <option value="completed">Selesai</option>
                            <option value="cancelled">Batal</option>
                          </select>
                          <button
                            onClick={() => handleOpenOrderModal(order)}
                            className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Edit Pesanan"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteOrder(order)}
                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="Hapus Pesanan"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {displayOrders.length === 0 && (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-gray-500">
                        {activeOrdersTab === 'active' ? 'Belum ada pesanan aktif.' : 'Belum ada riwayat pesanan.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'users' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100 text-gray-500 text-sm font-semibold uppercase tracking-wider">
                    <th className="p-4 pl-6">Email</th>
                    <th className="p-4">Tanggal Bergabung</th>
                    <th className="p-4">Peran</th>
                    <th className="p-4 pr-6 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                      <td className="p-4 pl-6 font-medium text-gray-900">
                        {u.email}
                      </td>
                      <td className="p-4 text-sm text-gray-500">
                        {u.createdAt?.seconds ? new Date(u.createdAt.seconds * 1000).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Baru saja'}
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          u.role === 'admin' ? 'bg-indigo-100 text-indigo-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {u.role === 'admin' ? 'Admin' : 'Pelanggan'}
                        </span>
                      </td>
                      <td className="p-4 pr-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {u.email !== 'obym.ppngroup@gmail.com' && (
                            <>
                              <button 
                                onClick={() => handleToggleAdmin(u.id, u.role)} 
                                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                                  u.role === 'admin' 
                                    ? 'bg-orange-50 text-orange-600 hover:bg-orange-100' 
                                    : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
                                }`}
                              >
                                {u.role === 'admin' ? 'Hapus Admin' : 'Jadikan Admin'}
                              </button>
                              <button
                                onClick={() => setUserToDelete(u.id)}
                                className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                title="Hapus Pengguna"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </>
                          )}
                          {u.email === 'obym.ppngroup@gmail.com' && (
                            <span className="text-xs text-gray-400 italic">Admin Utama</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-gray-500">Belum ada pengguna terdaftar.</td>
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Satuan</label>
                  <input type="text" value={formData.unit} onChange={(e) => setFormData({...formData, unit: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all outline-none" placeholder="pcs, kg, pack, dll" />
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
      {/* Modal Edit Pesanan */}
      {isOrderModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="px-8 py-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                <Edit className="h-6 w-6 text-indigo-600" />
                Edit Pesanan
              </h2>
              <button onClick={() => setIsOrderModalOpen(false)} className="p-2 text-gray-400 hover:bg-gray-100 rounded-full transition-colors">
                <X className="h-6 w-6" />
              </button>
            </div>
            <form onSubmit={handleSubmitOrder} className="p-8 overflow-y-auto flex-grow">
              <div className="space-y-4">
                {orderItems.map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-4 border border-gray-200 rounded-xl">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">{item.name}</h4>
                      <p className="text-sm text-gray-500">{formatRupiah(item.price)} {item.unit ? `/ ${item.unit}` : ''}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleUpdateOrderItemQuantity(index, (Number(item.quantity) || 1) - 1)}
                          className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => handleUpdateOrderItemQuantity(index, e.target.value)}
                          onBlur={(e) => {
                            if (!item.quantity || Number(item.quantity) < 1) {
                              handleUpdateOrderItemQuantity(index, 1);
                            }
                          }}
                          className="w-16 text-center border border-gray-200 rounded-lg py-1 focus:ring-2 focus:ring-indigo-200 outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => handleUpdateOrderItemQuantity(index, (Number(item.quantity) || 0) + 1)}
                          className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                        >
                          +
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveOrderItem(index)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                ))}
                {orderItems.length === 0 && (
                  <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                    Tidak ada produk dalam pesanan ini.
                  </div>
                )}
                
                <div className="mt-6 p-4 bg-indigo-50 rounded-xl flex justify-between items-center">
                  <span className="font-medium text-indigo-900">Total Pesanan:</span>
                  <span className="text-xl font-bold text-indigo-700">
                    {formatRupiah(orderItems.reduce((sum, item) => sum + (item.price * (Number(item.quantity) || 0)), 0))}
                  </span>
                </div>
              </div>
              <div className="pt-6 mt-6 flex justify-end gap-3 border-t border-gray-100">
                <button type="button" onClick={() => setIsOrderModalOpen(false)} className="px-6 py-3 rounded-xl font-medium text-gray-600 hover:bg-gray-100 transition-colors">Batal</button>
                <button type="submit" className="px-6 py-3 rounded-xl font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-sm flex items-center gap-2">
                  <Check className="h-5 w-5" />
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Hapus Pengguna */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full mb-4">
              <ShieldAlert className="h-6 w-6 text-red-600" />
            </div>
            <h3 className="text-lg font-bold text-center text-gray-900 mb-2">Hapus Pengguna</h3>
            <p className="text-center text-gray-500 mb-6">
              Apakah Anda yakin ingin menghapus pengguna ini? Tindakan ini tidak dapat dibatalkan.
            </p>
            <div className="flex justify-center gap-3">
              <button
                onClick={() => setUserToDelete(null)}
                className="px-6 py-2.5 rounded-xl font-medium text-gray-600 hover:bg-gray-100 transition-colors"
              >
                Batal
              </button>
              <button
                onClick={() => handleDeleteUser(userToDelete)}
                className="px-6 py-2.5 rounded-xl font-bold bg-red-600 text-white hover:bg-red-700 transition-colors shadow-sm"
              >
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
