export interface Product {
  id: string;
  productCode?: string;
  name: string;
  description: string;
  price: number;
  category: string;
  imageUrl: string;
  stock: number;
  unit?: string;
  createdAt: Date;
}

export interface OrderItem {
  productId: string;
  productCode?: string;
  name: string;
  quantity: number;
  price: number;
  unit?: string;
}

export interface Order {
  id: string;
  orderCode?: string;
  userId: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  items: OrderItem[];
  totalAmount: number;
  status: 'pending' | 'processing' | 'completed' | 'cancelled';
  createdAt: Date;
}

export interface CustomOrder {
  id: string;
  userId: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  productName: string;
  description: string;
  status: 'pending' | 'processing' | 'completed' | 'cancelled';
  createdAt: Date;
}

export interface UserProfile {
  id: string;
  email: string;
  role: 'admin' | 'customer';
  createdAt: Date;
}
