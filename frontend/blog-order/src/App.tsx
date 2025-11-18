import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { CartProvider } from "./contexts/CartContext";
import { GenerationCartProvider } from "./contexts/GenerationCartContext";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/Login";
import GenBlogs from "./pages/GenBlogs";
import EditBlogs from "./pages/EditBlogs";
import ViewBlogs from "./pages/ViewBlogs";
import CreateDomain from "./pages/CreateDomain";
import ViewDomains from "./pages/ViewDomains";
import ManageBacklinks from "./pages/ManageBacklinks";
import BacklinkReview from "./pages/BacklinkReview";
import Homepage from "./pages/Homepage";
import RequestArticle from "./pages/RequestArticle";
import VerifySession from "./pages/VerifySession";
import PaymentSuccess from "./pages/PaymentSuccess";
import CustomerBacklinkConfiguration from "./pages/CustomerBacklinkConfiguration";
import CustomerArticleConfiguration from "./pages/CustomerArticleConfiguration";
import ReviewSubmitted from "./pages/ReviewSubmitted";
import OrderStatus from "./pages/OrderStatus";
import CartCheckout from "./pages/CartCheckout";
import BulkOrderStatus from "./pages/BulkOrderStatus";
import GenerationCheckout from "./pages/GenerationCheckout";
import GenerationConfirmation from "./pages/GenerationConfirmation";
import VerifyGenerationSession from "./pages/VerifyGenerationSession";
import BulkGenerationStatus from "./pages/BulkGenerationStatus";
import RequestMultipleArticles from "./pages/RequestMultipleArticles";
import MultiArticleConfirmation from "./pages/MultiArticleConfirmation";
import { isAuthenticated } from "./services/authService";

function App() {
  return (
    <CartProvider>
      <GenerationCartProvider>
        <Router>
          <Routes>
            {/* Public routes */}
            <Route path="/purchase" element={<Homepage />} />
            <Route path="/request-article" element={<RequestArticle />} />
            <Route path="/verify" element={<VerifySession />} />
            <Route path="/payment/success" element={<PaymentSuccess />} />
            <Route path="/order-status" element={<OrderStatus />} />
            <Route path="/cart-checkout" element={<CartCheckout />} />
            <Route path="/bulk-order-status" element={<BulkOrderStatus />} />
            <Route
              path="/configure-backlink"
              element={<CustomerBacklinkConfiguration />}
            />
            <Route
              path="/configure-article"
              element={<CustomerArticleConfiguration />}
            />
            <Route path="/review-submitted" element={<ReviewSubmitted />} />

            {/* Article generation routes */}
            <Route
              path="/generation-checkout"
              element={<GenerationCheckout />}
            />
            <Route
              path="/generation-confirmation"
              element={<GenerationConfirmation />}
            />
            <Route
              path="/verify-generation"
              element={<VerifyGenerationSession />}
            />
            <Route
              path="/bulk-generation-status"
              element={<BulkGenerationStatus />}
            />

            {/* Multi-article request routes */}
            <Route
              path="/request-multiple-articles"
              element={<RequestMultipleArticles />}
            />
            <Route
              path="/multi-article-confirmation"
              element={<MultiArticleConfirmation />}
            />

            {/* Admin routes - keep original paths */}
            <Route path="/login" element={<Login />} />
            <Route
              path="/blogs/gen"
              element={
                <ProtectedRoute>
                  <Layout>
                    <GenBlogs />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/blogs/edit"
              element={
                <ProtectedRoute>
                  <Layout>
                    <EditBlogs />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/blogs/edit/:articleId"
              element={
                <ProtectedRoute>
                  <Layout>
                    <EditBlogs />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/blogs"
              element={
                <ProtectedRoute>
                  <Layout>
                    <ViewBlogs />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/backlinks"
              element={
                <ProtectedRoute>
                  <Layout>
                    <ManageBacklinks />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/backlink-review"
              element={
                <ProtectedRoute>
                  <Layout>
                    <BacklinkReview />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/domains/create"
              element={
                <ProtectedRoute>
                  <Layout>
                    <CreateDomain />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/domains"
              element={
                <ProtectedRoute>
                  <Layout>
                    <ViewDomains />
                  </Layout>
                </ProtectedRoute>
              }
            />

            {/* Default route - homepage for public, admin dashboard for authenticated */}
            <Route
              path="/"
              element={
                isAuthenticated() ? <Navigate to="/blogs" /> : <Homepage />
              }
            />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </Router>
      </GenerationCartProvider>
    </CartProvider>
  );
}

export default App;
