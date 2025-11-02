import { createContext, useContext, useState, useEffect } from "react";
import type { ReactNode } from "react";
import type { PublicArticle } from "../types/purchase";

export interface CartItem {
  article: PublicArticle;
  backlinkData: {
    keyword: string;
    targetUrl: string;
    notes?: string;
  };
}

interface CartContextType {
  items: CartItem[];
  addToCart: (
    article: PublicArticle,
    backlinkData: CartItem["backlinkData"]
  ) => boolean;
  removeFromCart: (articleId: string) => void;
  clearCart: () => void;
  isInCart: (articleId: string) => boolean;
  totalItems: number;
  totalPrice: number;
  isCartOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const MAX_CART_ITEMS = 20;
const PRICE_PER_BACKLINK = 15.0;
const CART_STORAGE_KEY = "blog-backlink-cart";

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);

  // Load cart from localStorage on mount
  useEffect(() => {
    try {
      const savedCart = localStorage.getItem(CART_STORAGE_KEY);
      if (savedCart) {
        const parsed = JSON.parse(savedCart);
        setItems(parsed);
      }
    } catch (error) {
      console.error("Failed to load cart from localStorage:", error);
    }
  }, []);

  // Save cart to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    } catch (error) {
      console.error("Failed to save cart to localStorage:", error);
    }
  }, [items]);

  const addToCart = (
    article: PublicArticle,
    backlinkData: CartItem["backlinkData"]
  ): boolean => {
    // Check if already in cart
    if (items.some((item) => item.article.id === article.id)) {
      alert("This article is already in your cart!");
      return false;
    }

    // Check max items limit
    if (items.length >= MAX_CART_ITEMS) {
      alert(
        `Cart is full! Maximum ${MAX_CART_ITEMS} articles allowed per purchase.`
      );
      return false;
    }

    // Validate backlink data
    if (!backlinkData.keyword || !backlinkData.targetUrl) {
      alert("Please provide both keyword and target URL");
      return false;
    }

    // Add to cart
    setItems((prev) => [...prev, { article, backlinkData }]);
    setIsCartOpen(true); // Auto-open cart drawer
    return true;
  };

  const removeFromCart = (articleId: string) => {
    setItems((prev) => prev.filter((item) => item.article.id !== articleId));
  };

  const clearCart = () => {
    setItems([]);
    localStorage.removeItem(CART_STORAGE_KEY);
  };

  const isInCart = (articleId: string): boolean => {
    return items.some((item) => item.article.id === articleId);
  };

  const openCart = () => setIsCartOpen(true);
  const closeCart = () => setIsCartOpen(false);

  const totalItems = items.length;
  const totalPrice = items.length * PRICE_PER_BACKLINK;

  return (
    <CartContext.Provider
      value={{
        items,
        addToCart,
        removeFromCart,
        clearCart,
        isInCart,
        totalItems,
        totalPrice,
        isCartOpen,
        openCart,
        closeCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
