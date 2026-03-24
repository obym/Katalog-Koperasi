import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Product } from '../types';
import { ProductCard } from '../components/ProductCard';
import { Search, Filter, Loader2, Package, PlusCircle, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const Catalog: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [randomOrder, setRandomOrder] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Semua');
  const { user, profile } = useAuth();
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [requestForm, setRequestForm] = useState({
    productName: '',
    description: '',
    customerName: '',
    customerPhone: '',
    customerAddress: '',
    price: '',
    quantity: '1',
    unit: 'pcs',
    imageUrl: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (user || profile) {
      setRequestForm(prev => ({
        ...prev,
        customerName: profile?.email?.split('@')[0] || user?.displayName || ''
      }));
    }
  }, [user, profile]);

  const handleRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      alert("Silakan login terlebih dahulu untuk meminta produk.");
      return;
    }
    
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'customOrders'), {
        userId: user.uid,
        customerName: requestForm.customerName,
        customerPhone: requestForm.customerPhone,
        customerAddress: requestForm.customerAddress,
        productName: requestForm.productName,
        description: requestForm.description,
        price: Number(requestForm.price) || 0,
        quantity: Number(requestForm.quantity) || 1,
        unit: requestForm.unit,
        imageUrl: requestForm.imageUrl,
        status: 'pending',
        createdAt: serverTimestamp()
      });
      setIsRequestModalOpen(false);
      setRequestForm({
        productName: '',
        description: '',
        customerName: profile?.email?.split('@')[0] || user.displayName || '',
        customerPhone: '',
        customerAddress: '',
        price: '',
        quantity: '1',
        unit: 'pcs',
        imageUrl: ''
      });
      alert("Permintaan produk berhasil dikirim!");
    } catch (error) {
      console.error("Error submitting request:", error);
      alert("Gagal mengirim permintaan. Silakan coba lagi.");
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    const q = query(collection(db, 'products'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const productsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
      })) as Product[];
      
      setRandomOrder(prev => {
        const newOrder = { ...prev };
        let changed = false;
        productsData.forEach(p => {
          if (newOrder[p.id] === undefined) {
            newOrder[p.id] = Math.random();
            changed = true;
          }
        });
        return changed ? newOrder : prev;
      });

      setProducts(productsData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching products:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const categories = ['Semua', ...Array.from(new Set(products.map((p) => p.category)))];

  const filteredProducts = products.filter((product) => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          product.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'Semua' || product.category === selectedCategory;
    return matchesSearch && matchesCategory;
  }).sort((a, b) => (randomOrder[a.id] || 0) - (randomOrder[b.id] || 0));

  if (loading) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center text-gray-500">
        <Loader2 className="h-12 w-12 animate-spin text-indigo-600 mb-4" />
        <p className="text-lg font-medium">Memuat katalog produk...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
        <div>
          <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight mb-2">Katalog Produk</h1>
          <p className="text-lg text-gray-500">Temukan berbagai produk kebutuhan Anda di sini.</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Cari produk..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-3 w-full sm:w-64 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all outline-none"
            />
          </div>
          
          <div className="relative min-w-[160px]">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="pl-10 pr-8 py-3 w-full rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all outline-none appearance-none bg-white"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {filteredProducts.length === 0 ? (
        <div className="text-center py-20 bg-gray-50 rounded-3xl border border-gray-100">
          <Package className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-gray-900 mb-2">Produk Tidak Ditemukan</h3>
          <p className="text-gray-500 mb-6">Coba ubah kata kunci pencarian atau kategori filter Anda.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {filteredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </>
      )}

      {/* Floating Request Button */}
      <button
        onClick={() => setIsRequestModalOpen(true)}
        className="fixed bottom-8 right-8 z-40 flex items-center gap-2 px-5 py-4 bg-indigo-600 text-white font-bold rounded-full shadow-xl hover:bg-indigo-700 hover:scale-105 transition-all"
        title="Tidak menemukan produk yang diinginkan?"
      >
        <PlusCircle className="h-6 w-6" />
        <span className="hidden sm:inline">Request Produk</span>
      </button>

      {/* Request Product Modal */}
      {isRequestModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900">Permintaan Produk Baru</h2>
              <button onClick={() => setIsRequestModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X className="h-6 w-6" />
              </button>
            </div>
            <form onSubmit={handleRequestSubmit} className="p-6 overflow-y-auto space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Lengkap</label>
                <input
                  type="text"
                  required
                  value={requestForm.customerName}
                  onChange={(e) => setRequestForm({ ...requestForm, customerName: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                  placeholder="Nama lengkap Anda"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nomor WhatsApp</label>
                <input
                  type="tel"
                  required
                  value={requestForm.customerPhone}
                  onChange={(e) => setRequestForm({ ...requestForm, customerPhone: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                  placeholder="Contoh: 08123456789"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Alamat Pengiriman</label>
                <textarea
                  required
                  value={requestForm.customerAddress}
                  onChange={(e) => setRequestForm({ ...requestForm, customerAddress: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all resize-none"
                  placeholder="Alamat lengkap pengiriman"
                />
              </div>
              <div className="border-t border-gray-100 pt-4 mt-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Produk yang Diinginkan</label>
                <input
                  type="text"
                  required
                  value={requestForm.productName}
                  onChange={(e) => setRequestForm({ ...requestForm, productName: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                  placeholder="Contoh: Beras Merah Organik 5kg"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Jumlah</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={requestForm.quantity}
                    onChange={(e) => setRequestForm({ ...requestForm, quantity: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                    placeholder="1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Satuan</label>
                  <input
                    type="text"
                    required
                    value={requestForm.unit}
                    onChange={(e) => setRequestForm({ ...requestForm, unit: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                    placeholder="Contoh: pcs, kg, pack"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Harga (Perkiraan / Target)</label>
                <input
                  type="number"
                  min="0"
                  value={requestForm.price}
                  onChange={(e) => setRequestForm({ ...requestForm, price: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                  placeholder="Contoh: 50000 (Kosongkan jika tidak tahu)"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">URL Gambar (Opsional)</label>
                <input
                  type="url"
                  value={requestForm.imageUrl}
                  onChange={(e) => setRequestForm({ ...requestForm, imageUrl: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                  placeholder="https://contoh.com/gambar.jpg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Deskripsi/Detail Produk</label>
                <textarea
                  required
                  value={requestForm.description}
                  onChange={(e) => setRequestForm({ ...requestForm, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all resize-none"
                  placeholder="Jelaskan secara detail produk yang Anda cari (merk, ukuran, dll)"
                />
              </div>
              
              <div className="pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsRequestModalOpen(false)}
                  className="px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Kirim Permintaan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
