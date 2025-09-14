import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
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
import VerifySession from "./pages/VerifySession";
import PaymentSuccess from "./pages/PaymentSuccess";
import { isAuthenticated } from "./services/authService";

function App() {
  return (
    <Router>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<Homepage />} />
        <Route path="/purchase" element={<Homepage />} />
        <Route path="/verify" element={<VerifySession />} />
        <Route path="/payment/success" element={<PaymentSuccess />} />
        
        {/* Admin routes */}
        <Route path="/admin/login" element={<Login />} />
        <Route
          path="/admin/*"
          element={
            <ProtectedRoute>
              <Layout>
                <Routes>
                  <Route path="/blogs/gen" element={<GenBlogs />} />
                  <Route path="/blogs/edit" element={<EditBlogs />} />
                  <Route path="/blogs/edit/:articleId" element={<EditBlogs />} />
                  <Route path="/blogs" element={<ViewBlogs />} />
                  <Route path="/backlinks" element={<ManageBacklinks />} />
                  <Route path="/backlink-review" element={<BacklinkReview />} />
                  <Route path="/domains/create" element={<CreateDomain />} />
                  <Route path="/domains" element={<ViewDomains />} />
                  <Route 
                    path="/" 
                    element={<Navigate to={isAuthenticated() ? "/admin/blogs" : "/admin/login"} />} 
                  />
                  <Route path="*" element={<Navigate to="/admin/blogs" />} />
                </Routes>
              </Layout>
            </ProtectedRoute>
          }
        />
        
        {/* Fallback for unknown routes */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}

export default App;
