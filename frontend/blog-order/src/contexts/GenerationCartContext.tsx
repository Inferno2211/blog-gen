import { createContext, useContext, useState, useEffect } from "react";
import type { ReactNode } from "react";

export interface GenerationRequest {
  domainId: string;
  domainName: string;
  domainSlug: string;
  topic: string;
  niche?: string;
  keyword?: string;
  targetUrl: string;
  anchorText: string;
  notes?: string;
}

interface GenerationCartContextType {
  requests: GenerationRequest[];
  addToCart: (request: GenerationRequest) => boolean;
  removeFromCart: (index: number) => void;
  updateRequest: (index: number, request: GenerationRequest) => void;
  clearCart: () => void;
  totalRequests: number;
  totalPrice: number;
  isCartOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
}

const GenerationCartContext = createContext<
  GenerationCartContextType | undefined
>(undefined);

const MAX_CART_REQUESTS = 20;
const PRICE_PER_ARTICLE = 25.0;
const CART_STORAGE_KEY = "article-generation-cart";

export function GenerationCartProvider({ children }: { children: ReactNode }) {
  const [requests, setRequests] = useState<GenerationRequest[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);

  // Load cart from localStorage on mount
  useEffect(() => {
    try {
      const savedCart = localStorage.getItem(CART_STORAGE_KEY);
      if (savedCart) {
        const parsed = JSON.parse(savedCart);
        setRequests(parsed);
      }
    } catch (error) {
      console.error("Failed to load generation cart from localStorage:", error);
    }
  }, []);

  // Save cart to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(requests));
    } catch (error) {
      console.error("Failed to save generation cart to localStorage:", error);
    }
  }, [requests]);

  const addToCart = (request: GenerationRequest): boolean => {
    // Check if duplicate topic on same domain
    const duplicate = requests.find(
      (r) =>
        r.domainId === request.domainId &&
        r.topic.toLowerCase().trim() === request.topic.toLowerCase().trim()
    );

    if (duplicate) {
      alert(
        `You already have a request for "${request.topic}" on ${request.domainName}!`
      );
      return false;
    }

    // Check max items limit
    if (requests.length >= MAX_CART_REQUESTS) {
      alert(
        `Cart is full! Maximum ${MAX_CART_REQUESTS} articles allowed per request.`
      );
      return false;
    }

    // Validate request
    if (
      !request.topic ||
      !request.targetUrl ||
      !request.anchorText ||
      !request.domainId
    ) {
      alert("Please provide topic, target URL, anchor text, and domain");
      return false;
    }

    // Add to cart
    setRequests((prev) => [...prev, request]);
    setIsCartOpen(true); // Auto-open cart drawer
    return true;
  };

  const removeFromCart = (index: number) => {
    setRequests((prev) => prev.filter((_, i) => i !== index));
  };

  const updateRequest = (index: number, request: GenerationRequest) => {
    setRequests((prev) => prev.map((r, i) => (i === index ? request : r)));
  };

  const clearCart = () => {
    setRequests([]);
    localStorage.removeItem(CART_STORAGE_KEY);
  };

  const openCart = () => setIsCartOpen(true);
  const closeCart = () => setIsCartOpen(false);

  const totalRequests = requests.length;
  const totalPrice = totalRequests * PRICE_PER_ARTICLE;

  return (
    <GenerationCartContext.Provider
      value={{
        requests,
        addToCart,
        removeFromCart,
        updateRequest,
        clearCart,
        totalRequests,
        totalPrice,
        isCartOpen,
        openCart,
        closeCart,
      }}
    >
      {children}
    </GenerationCartContext.Provider>
  );
}

export function useGenerationCart() {
  const context = useContext(GenerationCartContext);
  if (context === undefined) {
    throw new Error(
      "useGenerationCart must be used within a GenerationCartProvider"
    );
  }
  return context;
}
