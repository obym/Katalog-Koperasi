import React, { useState } from 'react';
import { Product } from '../types';
import { useCart } from '../context/CartContext';
import { ShoppingCart, X } from 'lucide-react';

interface ProductCardProps {
  product: Product;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const { addToCart } = useCart();
  const [isAdding, setIsAdding] = useState(false);
  const [quantity, setQuantity] = useState<number | string>(1);

  const formatRupiah = (price: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const handleAddToCartClick = () => {
    setIsAdding(true);
    setQuantity(1);
  };

  const handleConfirmAdd = () => {
    const qty = typeof quantity === 'string' ? parseInt(quantity) : quantity;
    if (!isNaN(qty) && qty > 0) {
      addToCart(product, qty);
    }
    setIsAdding(false);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow duration-300 flex flex-col h-full">
      <div className="relative aspect-square overflow-hidden bg-gray-50">
        <img
          src={product.imageUrl}
          alt={product.name}
          className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
          referrerPolicy="no-referrer"
        />
        <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-semibold text-indigo-600 shadow-sm">
          {product.category}
        </div>
        {product.productCode && (
          <div className="absolute top-3 right-3 bg-gray-900/80 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-bold text-white shadow-sm tracking-wide">
            {product.productCode}
          </div>
        )}
      </div>
      <div className="p-5 flex flex-col flex-grow">
        <h3 className="text-lg font-bold text-gray-900 mb-1 line-clamp-2">{product.name}</h3>
        <p className="text-sm text-gray-500 mb-4 line-clamp-2 flex-grow">{product.description}</p>
        <div className="flex items-end justify-between mt-auto">
          <div>
            <p className="text-xs text-gray-500 mb-1">Stok: {product.stock} {product.unit || ''}</p>
            <p className="text-xl font-bold text-gray-900">{formatRupiah(product.price)}<span className="text-sm font-normal text-gray-500">{product.unit ? ` / ${product.unit}` : ''}</span></p>
          </div>
          
          {isAdding ? (
            <div className="flex items-center gap-1 bg-gray-50 p-1.5 rounded-xl border border-gray-200">
              <input
                type="number"
                min="1"
                max={product.stock}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                onBlur={() => {
                  let val = parseInt(quantity as string);
                  if (isNaN(val) || val < 1) val = 1;
                  if (val > product.stock) val = product.stock;
                  setQuantity(val);
                }}
                className="w-10 text-center bg-transparent py-1 text-sm font-medium focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                autoFocus
              />
              <button
                onClick={handleConfirmAdd}
                className="flex items-center justify-center p-2 rounded-lg transition-colors bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95"
                title="Konfirmasi Tambah ke Keranjang"
              >
                <ShoppingCart className="h-4 w-4" />
              </button>
              <button
                onClick={() => setIsAdding(false)}
                className="flex items-center justify-center p-2 rounded-lg transition-colors bg-gray-200 text-gray-600 hover:bg-gray-300 active:scale-95"
                title="Batal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={handleAddToCartClick}
              disabled={product.stock === 0}
              className={`flex items-center justify-center p-3 rounded-xl transition-colors ${
                product.stock > 0
                  ? 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
              title={product.stock > 0 ? "Tambah ke Keranjang" : "Stok Habis"}
            >
              <ShoppingCart className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
