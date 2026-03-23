import React, { useState } from 'react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Trash2, Plus, Minus, ShoppingBag, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';

export const Cart: React.FC = () => {
  const { cart, updateQuantity, removeFromCart, totalPrice, clearCart } = useCart();
  const { user, signInWithGoogle } = useAuth();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  
  const [formData, setFormData] = useState({
    customerName: user?.displayName || '',
    customerPhone: '',
    customerAddress: '',
  });

  const formatRupiah = (price: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      // Use a toast or custom modal in a real app
      console.error("Silakan login terlebih dahulu untuk melakukan pemesanan.");
      return;
    }

    if (cart.length === 0) return;

    setIsSubmitting(true);
    try {
      const orderData = {
        userId: user.uid,
        customerName: formData.customerName,
        customerPhone: formData.customerPhone,
        customerAddress: formData.customerAddress,
        items: cart.map(item => ({
          productId: item.id,
          name: item.name,
          quantity: item.quantity,
          price: item.price
        })),
        totalAmount: totalPrice,
        status: 'pending',
        createdAt: serverTimestamp(),
      };

      await addDoc(collection(db, 'orders'), orderData);
      clearCart();
      setIsSuccess(true);
    } catch (error) {
      console.error("Error submitting order:", error);
      // alert("Terjadi kesalahan saat membuat pesanan. Silakan coba lagi.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-24 text-center">
        <div className="bg-emerald-50 text-emerald-600 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 className="h-12 w-12" />
        </div>
        <h1 className="text-4xl font-extrabold text-gray-900 mb-4">Pesanan Berhasil!</h1>
        <p className="text-lg text-gray-600 mb-10">Terima kasih telah berbelanja. Pesanan Anda sedang kami proses.</p>
        <Link to="/" className="inline-flex items-center gap-2 bg-indigo-600 text-white px-8 py-4 rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-sm">
          <ShoppingBag className="h-5 w-5" />
          Kembali Belanja
        </Link>
      </div>
    );
  }

  if (cart.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-24 text-center">
        <div className="bg-gray-50 text-gray-400 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6">
          <ShoppingBag className="h-12 w-12" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Keranjang Kosong</h1>
        <p className="text-gray-500 mb-10">Anda belum menambahkan produk apapun ke keranjang.</p>
        <Link to="/" className="inline-flex items-center gap-2 bg-indigo-600 text-white px-8 py-4 rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-sm">
          Mulai Belanja
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-3xl font-extrabold text-gray-900 mb-10">Keranjang Belanja</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        <div className="lg:col-span-2 space-y-6">
          {cart.map((item) => (
            <div key={item.id} className="flex flex-col sm:flex-row gap-6 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
              <div className="w-full sm:w-32 h-32 bg-gray-50 rounded-xl overflow-hidden flex-shrink-0">
                <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              </div>
              <div className="flex-grow flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-lg font-bold text-gray-900 line-clamp-2 pr-4">{item.name}</h3>
                    <button 
                      onClick={() => removeFromCart(item.id)}
                      className="text-gray-400 hover:text-red-500 transition-colors p-1"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                  <p className="text-indigo-600 font-bold">{formatRupiah(item.price)}</p>
                </div>
                <div className="flex items-center gap-4 mt-4 sm:mt-0">
                  <div className="flex items-center bg-gray-50 rounded-lg border border-gray-200">
                    <button 
                      onClick={() => updateQuantity(item.id, item.quantity - 1)}
                      className="p-2 text-gray-600 hover:text-indigo-600 transition-colors"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="w-12 text-center font-medium text-gray-900">{item.quantity}</span>
                    <button 
                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      className="p-2 text-gray-600 hover:text-indigo-600 transition-colors"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="text-sm text-gray-500 font-medium">
                    Total: {formatRupiah(item.price * item.quantity)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="lg:col-span-1">
          <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm sticky top-24">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Ringkasan Pesanan</h2>
            
            <div className="space-y-4 mb-8">
              <div className="flex justify-between text-gray-600">
                <span>Total Item</span>
                <span className="font-medium text-gray-900">{cart.reduce((sum, item) => sum + item.quantity, 0)}</span>
              </div>
              <div className="h-px bg-gray-100 w-full my-4"></div>
              <div className="flex justify-between items-end">
                <span className="text-gray-600 font-medium">Total Harga</span>
                <span className="text-2xl font-extrabold text-indigo-600">{formatRupiah(totalPrice)}</span>
              </div>
            </div>

            {!user ? (
              <button 
                onClick={signInWithGoogle}
                className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-sm flex items-center justify-center gap-2"
              >
                Login untuk Lanjut
                <ArrowRight className="h-5 w-5" />
              </button>
            ) : (
              <form onSubmit={handleCheckout} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nama Lengkap</label>
                  <input 
                    type="text" 
                    required
                    value={formData.customerName}
                    onChange={(e) => setFormData({...formData, customerName: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all outline-none"
                    placeholder="Masukkan nama lengkap"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nomor WhatsApp</label>
                  <input 
                    type="tel" 
                    required
                    value={formData.customerPhone}
                    onChange={(e) => setFormData({...formData, customerPhone: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all outline-none"
                    placeholder="081234567890"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Alamat Pengiriman</label>
                  <textarea 
                    required
                    rows={3}
                    value={formData.customerAddress}
                    onChange={(e) => setFormData({...formData, customerAddress: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all outline-none resize-none"
                    placeholder="Alamat lengkap beserta kode pos"
                  ></textarea>
                </div>
                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-sm flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed mt-4"
                >
                  {isSubmitting ? 'Memproses...' : 'Buat Pesanan Sekarang'}
                  {!isSubmitting && <ArrowRight className="h-5 w-5" />}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
