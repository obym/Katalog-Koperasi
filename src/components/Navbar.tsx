import React from 'react';
import { Link } from 'react-router-dom';
import { ShoppingCart, Package, LogIn, LogOut, Shield } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';

export const Navbar: React.FC = () => {
  const { user, isAdmin, signInWithGoogle, logout } = useAuth();
  const { totalItems } = useCart();

  return (
    <nav className="bg-white shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex items-center">
            <Link to="/" className="flex items-center gap-2 sm:gap-3">
              <Package className="h-8 w-8 text-indigo-600 shrink-0" />
              <div className="flex flex-col">
                <span className="font-bold text-sm sm:text-lg text-gray-900 leading-tight">Koperasi</span>
                <span className="font-bold text-xs sm:text-base text-indigo-600 leading-tight">Kumpul Dulur Sejahtera</span>
              </div>
            </Link>
          </div>

          <div className="flex items-center gap-6">
            <Link to="/cart" className="relative flex items-center text-gray-600 hover:text-indigo-600 transition-colors">
              <ShoppingCart className="h-6 w-6" />
              {totalItems > 0 && (
                <span className="absolute -top-2 -right-2 bg-indigo-600 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                  {totalItems}
                </span>
              )}
            </Link>

            {isAdmin && (
              <Link to="/admin" className="flex items-center gap-1 text-gray-600 hover:text-indigo-600 transition-colors">
                <Shield className="h-5 w-5" />
                <span className="hidden sm:inline font-medium">Admin</span>
              </Link>
            )}

            {user ? (
              <div className="flex items-center gap-4">
                <div className="hidden sm:flex items-center gap-2">
                  <img src={user.photoURL || ''} alt="Profile" className="h-8 w-8 rounded-full border border-gray-200" />
                  <span className="text-sm font-medium text-gray-700">{user.displayName}</span>
                </div>
                <button
                  onClick={logout}
                  className="flex items-center gap-1 text-gray-600 hover:text-red-600 transition-colors"
                >
                  <LogOut className="h-5 w-5" />
                  <span className="hidden sm:inline font-medium">Keluar</span>
                </button>
              </div>
            ) : (
              <button
                onClick={async () => {
                  try {
                    await signInWithGoogle();
                  } catch (error: any) {
                    alert(`Gagal login: ${error.message || 'Terjadi kesalahan'}. Pastikan domain Vercel Anda sudah ditambahkan ke Authorized Domains di Firebase Console.`);
                  }
                }}
                className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors font-medium shadow-sm"
              >
                <LogIn className="h-5 w-5" />
                <span>Masuk</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};
