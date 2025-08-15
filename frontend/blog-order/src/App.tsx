import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import Layout from "./components/Layout";
import GenBlogs from "./pages/GenBlogs";
import EditBlogs from "./pages/EditBlogs";
import ViewBlogs from "./pages/ViewBlogs";
import CreateDomain from "./pages/CreateDomain";
import ViewDomains from "./pages/ViewDomains";

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/blogs/gen" element={<GenBlogs />} />
          <Route path="/blogs/edit" element={<EditBlogs />} />
          <Route path="/blogs/edit/:articleId" element={<EditBlogs />} />
          <Route path="/blogs" element={<ViewBlogs />} />
          <Route path="/domains/create" element={<CreateDomain />} />
          <Route path="/domains" element={<ViewDomains />} />
          <Route path="*" element={<Navigate to="/blogs" />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;
